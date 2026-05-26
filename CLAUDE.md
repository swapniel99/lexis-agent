# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

EAGV3 Session 7 agent — a four-role cognitive architecture (Perception → Decision → Action → Memory) extended with FAISS-backed vector retrieval and document indexing. Built on top of a separately-running LLM gateway (llm_gatewayV7, expected at `../llm_gatewayV7`).

Session 7 is **incremental over Session 6**. The four roles, Pydantic contracts, agent loop, and MCP tools are unchanged from S6. S7 adds: one `embedding` field on `MemoryItem`, FAISS vector search in the Memory read path, `vector_index.py`, and two new MCP tools (`index_document`, `search_knowledge`). Architecture specs and query traces for the S6 baseline (queries A–D) live in `docs/session6-notes.md`. S7-specific additions and queries E–H live in `docs/session7-notes.md`.

## Commands

```bash
# Install dependencies (uses uv)
uv sync

# Run the agent with a query
uv run agent7.py "Your query here"

# Run all tests
uv run pytest

# Run tests by marker
uv run pytest -m network      # tests requiring internet
uv run pytest -m embed        # tests requiring the gateway embed endpoint

# Run MCP server standalone (stdio transport)
uv run mcp_server.py

# Reset agent state (clears memory and FAISS index)
rm -f state/memory.json state/index.faiss state/index_ids.json
```

## Prerequisites

- The LLM gateway (llm_gatewayV7) must be running on `http://localhost:8107`. The agent auto-starts it via `ensure_gateway()` if the directory exists at `../llm_gatewayV7`.
- `.env` file in the project root with `TAVILY_API_KEY` (optional; DuckDuckGo fallback used if absent).
- Ollama running locally with `nomic-embed-text` model for embeddings; Gemini fallback configured in the gateway.

## Architecture

**Four roles, strict separation of concerns:**

| Role | File | Responsibility |
|------|------|---------------|
| Perception | `perception.py` | Decomposes query into `Goal` list; maintains goal state across iterations; decides artifact attachment. Never sees MCP tool names. |
| Decision | `decision.py` | Picks next action for one goal: emit an answer or call one MCP tool. Sees the full tool catalogue. |
| Action | `action.py` | Executes MCP tool calls via `ClientSession`; pushes large payloads to artifact store. |
| Memory | `memory.py` | Read/write typed `MemoryItem` records. Reads: FAISS vector search first, keyword fallback. Writes: embed at insert time for `fact`/`preference`/`tool_outcome`. |

**Agent loop** (`agent7.py`): memory.read → perception.observe → decision.next_step → action.execute → memory.record_outcome. Max 20 iterations. MCP server runs as a subprocess (stdio transport).

**Schemas** (`schemas.py`): Single source of truth for `MemoryItem`, `Goal`, `Observation`, `ToolCall`, `DecisionOutput`. All inter-role communication uses these Pydantic models.

**Vector index** (`vector_index.py`): Wraps FAISS `IndexFlatIP` with L2-normalized vectors (cosine similarity). Persisted to `state/index.faiss` + `state/index_ids.json`. Reloaded from disk on every call for cross-process consistency (agent + MCP subprocess both write to it).

**MCP tools** (`mcp_server.py`): 11 tools — `web_search`, `fetch_url`, `get_time`, `currency_convert`, `read_file`, `list_dir`, `create_file`, `update_file`, `edit_file`, `index_document`, `search_knowledge`. File tools are sandboxed under `./sandbox/`.

**Gateway** (`gateway.py`): Auto-starts llm_gatewayV7 on port 8107. Exposes `LLM` client and `embed()` helper. Embedding endpoint: `POST /v1/embed` → 768-d vector (Ollama `nomic-embed-text` primary, Gemini `gemini-embedding-001` at 768d fallback).

---

## Separation of Concerns — Role Boundaries

This is the load-bearing invariant of the architecture. Each role has exactly one job, and the information each role receives is deliberately restricted to what that job requires.

### What each role sees

| Role | Sees | Does NOT see |
|------|------|--------------|
| Perception | Query, memory hits, history, prior goal list | Raw artifact bytes, MCP tool names |
| Decision | One current goal, memory hits, history, raw artifact bytes (if Perception attached them), MCP tools available | Other goals, the full goal list |
| Action | One `ToolCall` (name + arguments) | Goals, memory, history, LLM |
| Memory | Text to embed/classify, `ToolCall` + result text | Goals, history, artifact bytes |

### Perception: orchestrator, not planner

Perception's job is **what** needs to happen and **in what order**, expressed in intent language, never in tool names. It does not decide *how* — that belongs to Decision.

**Goal stability rules** (implemented in `perception.py`):
- Goals are identified by **position**.
- **Sticky-done**: once a goal is marked done, it cannot be un-done in a later iteration. Implemented by carrying forward `prior_goals[i].done` and OR-ing with the LLM's proposal.
- **Synthesis gate**: Synthesis/answer-type goals cannot be marked done unless there is an `answer` history entry which satisfies that particular goal.
- **Discovery-time expansion**: when a discovery action (e.g. `list_dir`) reveals concrete items that weren't knowable at decomposition time, Perception may **append** add goals after the existing done goals but before the final synthesis goal. Duplicates of prior goal texts are filtered out.

**Artifact attachment** is Perception's exclusive job. Perception signals `send_artifact: true` and an `artifact_index` pointing at a memory-hit slot. The agent loop resolves this to bytes and passes them to Decision. Decision never decides which artifact to attach — it only consumes what Perception chose.

### Decision: tool-selector, not orchestrator

Decision sees exactly **one goal at a time**. It has no visibility into other goals or into the full goal list. Its only question: given this goal, this memory context, and these available tools — should I call a tool or emit an answer?

Decision is the only layer that sees MCP tool names. The tool catalogue is passed as `mcp_tools` from the agent loop; Decision's SYSTEM prompt may contain tool-selection guidance but cannot reference specific tools by name. It should pick the tool based on the goal and the memory hits.

> **TODO**: `decision.py`'s current SYSTEM string names specific tools (`index_document`, `search_knowledge`, `read_file`, etc.). This violates the intent above. That guidance belongs in the MCP tool docstrings, not in the SYSTEM prompt. Migrate progressively — move each rule into the relevant tool's docstring, then remove it from SYSTEM.

Decision emits exactly one of two things: a `ToolCall` or a plain-text answer. Never both. `DecisionOutput` enforces this at the schema level.

### Action: pure executor

Action makes no decisions and calls no LLM. It takes a `ToolCall`, executes it via the MCP `ClientSession`, collapses the response to text, and offloads large payloads (> 4 KB) to the artifact store. It returns `(result_text, artifact_id | None)`.

One guard lives here: if a tool argument for `path` or `url` starts with `art:`, Action returns an error rather than forwarding it to the MCP server. Artifact handles are not file paths.

### Memory: stateful service, not a participant

Memory is a typed read/write service. It does not participate in goal planning or tool selection. The agent loop calls it at the start of each iteration (read) and after each action (write). Memory never sees goals, history, or artifact bytes — only text to embed/classify and tool outcomes to record.

The two write paths:
- `remember()` — LLM-classifies free-form text into a `MemoryItem` (used for the user's query and discovered preferences)
- `record_outcome()` — deterministic, zero-LLM; constructs a `tool_outcome` item from the ToolCall and result text
- `add_fact()` — used by `index_document`; writes a chunk directly as a `fact` with an embedding, no LLM classification

### Agent loop: coordinator only

`agent7.py` contains no intelligence. Its only jobs are: sequence the four roles in order, resolve Perception's artifact index to bytes, pass the right inputs to each role, and append to the history list. Any logic that requires judgment about goals, tools, or memory belongs in one of the four roles, not in the loop.

History format stored per iteration:
```python
# tool call turn
{"iter": N, "kind": "action", "goal_id": ..., "tool": ..., "arguments": ...,
 "result_descriptor": ..., "artifact_id": ...}

# answer turn
{"iter": N, "kind": "answer", "goal_id": ..., "text": ...}
```

## State on disk

```
state/
  memory.json      — all MemoryItem records (source of truth)
  index.faiss      — FAISS binary index (vectors only)
  index_ids.json   — parallel list mapping FAISS row → MemoryItem.id
```

Scratchpad items are excluded from the FAISS index. Clearing state requires deleting all three files. **Changing the embedding model invalidates existing index files** — delete and rebuild.

## Architectural invariant

**Perception is tool-blind.** No MCP tool names appear in `perception.py`'s SYSTEM prompt. Tool selection belongs in Decision's SYSTEM prompt and in MCP tool docstrings. Verify with:

```bash
grep -n "index_document\|search_knowledge\|web_search\|fetch_url" perception.py
# should return nothing
```

## Test corpus

Research papers live in `sandbox/papers/`: `attention.md`, `cot.md`, `dpo.md`, `lora.md`, `react.md`. These are the corpus for the Session 7 RAG queries.
