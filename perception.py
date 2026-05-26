"""Perception: the agent's orchestrator.

Runs every loop iteration. Looks at the user's original query, the memory
hits, and the run history so far, and emits the current Observation —
which goals exist, which are done, and whether the next unfinished goal
needs raw bytes from a specific artifact.

Perception never reads artifact bytes. It sees handles + descriptors only.
When a goal needs bytes, Perception flips `send_artifact: true` and points
`artifact_index` at one of the artifacts listed in MEMORY HITS. The outer
loop resolves the index back to the artifact id and attaches the bytes.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

from gateway import LLM, ensure_gateway
from schemas import Goal, MemoryItem, Observation, new_id

_SYSTEM_PROMPT_PATH = Path(__file__).parent / "prompts" / "perception_system.txt"


class _GoalDelta(BaseModel):
    """What the Perception LLM emits per goal. No `id` field — goals are
    identified by their position in the output list. The LLM cannot drift
    identity across iterations because there is no identity field to drift."""

    text: str = Field(max_length=240)
    done: bool = False
    send_artifact: bool = False
    artifact_index: int | None = None


class _PerceptionOutput(BaseModel):
    goals: list[_GoalDelta] = Field(default_factory=list, max_length=10)


SYSTEM = _SYSTEM_PROMPT_PATH.read_text()


def _snapshot_history(history: list[dict]) -> list[dict]:
    out = []
    for h in history[-10:]:
        clipped = {}
        for k, v in h.items():
            if isinstance(v, str) and len(v) > 240:
                clipped[k] = v[:240] + "..."
            else:
                clipped[k] = v
        out.append(clipped)
    return out


def _snapshot_hits(hits: list[MemoryItem]) -> list[dict]:
    """Render the memory hits the LLM sees. Artifacts are indexed (i) so
    Perception can point at them by integer; non-artifact hits show i=null."""
    art_pos = 0
    out = []
    for h in hits[:12]:
        i = None
        if h.artifact_id:
            i = art_pos
            art_pos += 1
        out.append({
            "i": i,
            "kind": h.kind,
            "descriptor": h.descriptor,
            "keywords": h.keywords,
            "artifact_id": h.artifact_id,
        })
    return out


def observe(
    query: str,
    hits: list[MemoryItem],
    history: list[dict],
    prior_goals: list[Goal],
    run_id: str,
) -> Observation:
    ensure_gateway()

    art_ids_in_order = [h.artifact_id for h in hits[:12] if h.artifact_id]

    prior_snapshot = [g.model_dump() for g in prior_goals] if prior_goals else []
    prompt = (
        f"USER QUERY:\n  {query}\n\n"
        f"PRIOR GOALS:\n{json.dumps(prior_snapshot, indent=2)}\n\n"
        f"MEMORY HITS (handles + descriptors only, no raw bytes; `i` is the\n"
        f"artifact_index to pass back when send_artifact is true):\n"
        f"{json.dumps(_snapshot_hits(hits), indent=2)}\n\n"
        f"RUN HISTORY (last 10 events):\n"
        f"{json.dumps(_snapshot_history(history), indent=2, default=str)}\n\n"
        f"Return the current goal list as JSON matching the schema."
    )

    schema = _PerceptionOutput.model_json_schema()
    reply = LLM().chat(
        prompt=prompt,
        system=SYSTEM,
        auto_route="perception",
        provider="g",
        response_format={
            "type": "json_schema",
            "schema": schema,
            "name": "PerceptionOutput",
            "strict": True,
        },
        temperature=1.0,
    )

    parsed = reply.get("parsed")
    if not parsed or not parsed.get("goals"):
        return Observation(goals=[Goal(id=new_id("g"), text=query)])

    # Synthesis-type goals require Decision to actually produce a
    # substantive answer; we won't let Perception declare them done on the
    # strength of a tool-call alone.
    SYNTHESIS_KW = (
        "evaluate", "select", "synthes", "compare", "decide", "recommend",
        "tell me which", "most appropriate", "analy", "pick", "choose",
        "summarise", "summarize", "answer", "identify", "find", "determine",
        "extract", "list", "report", "tell", "explain", "describe", "name",
    )

    # Goal-count invariant: never contract, never reorder. Prior goals keep
    # their slot and id; Perception may APPEND new goals after the prior
    # list when a discovery action (e.g. list_dir) reveals work that wasn't
    # knowable on iter 1. NOTES_RUNS §6 (4): the previous hard-truncate to
    # `len(prior_goals)` blocked F-run-1 verbatim — list_dir revealed five
    # papers, but the goal list was locked to the three placeholders emitted
    # before the listing was known. We still drop appended goals whose text
    # duplicates a prior goal (the temp=1.0 dup-append failure mode that
    # motivated the original lock).
    raw_goals = parsed["goals"]
    if prior_goals:
        prior_texts = {g.text.strip().lower() for g in prior_goals}
        deduped = list(raw_goals[:len(prior_goals)])
        for extra in raw_goals[len(prior_goals):]:
            t = (extra.get("text") or "").strip().lower()
            if not t or t in prior_texts:
                continue
            prior_texts.add(t)
            deduped.append(extra)
        raw_goals = deduped

    out_goals: list[Goal] = []
    for i, d in enumerate(raw_goals):
        delta = _GoalDelta.model_validate(d)
        attach: str | None = None
        if delta.send_artifact and delta.artifact_index is not None:
            if 0 <= delta.artifact_index < len(art_ids_in_order):
                attach = art_ids_in_order[delta.artifact_index]

        gid = prior_goals[i].id if i < len(prior_goals) else new_id("g")
        was_done = prior_goals[i].done if i < len(prior_goals) else False

        proposed_done = was_done or delta.done
        if proposed_done and not was_done:
            gtext_lc = delta.text.lower()
            if any(kw in gtext_lc for kw in SYNTHESIS_KW):
                has_answer = any(
                    h.get("kind") == "answer"
                    and h.get("goal_id") == gid
                    and len((h.get("text") or "")) > 60
                    for h in history
                )
                if not has_answer:
                    proposed_done = False

        out_goals.append(Goal(
            id=gid,
            text=delta.text,
            done=proposed_done,
            attach_artifact_id=attach,
        ))

    # Safety net: if the first unfinished goal needs raw bytes (its text
    # matches a synthesis keyword) AND we have artifacts in memory AND the
    # model forgot to set send_artifact, force-attach the most recent
    # artifact. The LLM at temp=1.0 is otherwise too unreliable about this.
    for g in out_goals:
        if g.done:
            continue
        if g.attach_artifact_id:
            break  # already attached, nothing to do
        if not art_ids_in_order:
            break  # no artifacts available yet
        if any(kw in g.text.lower() for kw in SYNTHESIS_KW):
            g.attach_artifact_id = art_ids_in_order[-1]
        break  # only act on the FIRST unfinished goal
    return Observation(goals=out_goals)
