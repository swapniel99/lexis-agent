# Implementation Plan — Session 7 Agent

All core components exist. Plan = test, fix if broken, then run the eight required queries, then build the RAG application. No step advances until exit criteria met.

---

## Step 0 — Environment baseline

- `curl localhost:8107/v1/routers` returns 200.
- `ollama run nomic-embed-text` model present (`ollama list` shows it).
- `uv run python mcp_server.py` starts, no traceback (Ctrl-C to stop).
- `state/` dir exists (create if absent).
- `sandbox/papers/` has all five files: `attention.md`, `cot.md`, `dpo.md`, `lora.md`, `react.md`.

**Exit:** gateway reachable + Ollama embed model present + MCP server boots clean + corpus on disk.

---

## Step 1 — `schemas.py`

Verify all contracts present and well-formed.

**Exit:**
- `uv run python -c "import schemas"` — no error.
- `MemoryItem` has optional `embedding: list[float] | None` field.
- `Observation.all_done` and `next_unfinished()` work correctly.
- `DecisionOutput(answer='hi').is_answer is True`; `DecisionOutput(tool_call=ToolCall(name='t', arguments={})).is_answer is False`.
- `DecisionOutput` with both or neither `answer`/`tool_call` raises `ValueError`.

---

## Step 2 — `vector_index.py`

Verify FAISS operations: add, search, persist, reload.

**Exit:**
- `VectorIndex.add(id, vector)` → `size` increments.
- `search(query_vector, k=3)` returns list of `(id, score)` tuples, scores descending.
- `persist()` writes `index.faiss` + `index_ids.json`; fresh `VectorIndex` reloaded from those files returns same results.
- Adding a vector of wrong dimension raises error before corrupting the index.
- Cold-start rebuild from embeddings in `memory.json` works when index files absent.

---

## Step 3 — `memory.py`

Verify all read/write paths.

**Exit:**
- `remember("My mom's birthday is 15 May 2026", source="test", run_id="r1")` → `MemoryItem` kind=`fact`, keywords include `mom`/`birthday`, value holds the date.
- `state/memory.json` parses after write; fresh reload contains the item.
- `read("when is mom birthday", [])` returns that item (vector path, since embedding was computed at write).
- With gateway unreachable (stub), `read` falls back to keyword overlap and still returns relevant items.
- `record_outcome(tool_call, result_text, None, run_id, goal_id)` → appends `tool_outcome` item, zero LLM calls.
- `add_fact(descriptor, value=..., keywords=..., source=..., run_id=...)` → kind=`fact`, embedding set, FAISS index updated on disk.
- Scratchpad items have `embedding=None` and do not appear in FAISS index.

---

## Step 4 — `artifacts.py`

**Exit:**
- `put(b"hello", content_type="text/plain", source="test", descriptor="d")` → `art:`-prefixed id; `.bin` + `.json` files written under `state/artifacts/`.
- `get_bytes(id) == b"hello"`; `get_meta(id)` is valid `Artifact`.
- `exists("art:bogus") is False`.

---

## Step 5 — `action.py`

**Exit:**
- `execute(session, ToolCall(name="get_time", arguments={"timezone":"UTC"}))` → `(str, None)`, str contains time data.
- `execute(session, ToolCall(name="fetch_url", arguments={"url":"art:abc"}))` → error string mentioning artifact handle, `None`, MCP not called.
- Large fetch payload (real page > 4 KB) → `("[artifact art:..., N bytes]", art_id)`; artifact file written to disk.

---

## Step 6 — `perception.py`

Verify orchestration invariants.

**Exit:**
- `grep -n "index_document\|search_knowledge\|web_search\|fetch_url\|create_file\|read_file" perception.py` inside the SYSTEM string returns nothing.
- First call (`prior_goals=[]`) on Query A text → `Observation` with ≥2 goals, all `done=False`.
- Second call with history containing a satisfying action → that goal `done=True`, others unchanged, same count, same order.
- Synthesis-type goal not marked done without an `answer` history entry for that goal id.
- Discovery-time expansion: after a `list_dir` action revealing N files, Perception appends N new goals without removing or reordering prior ones.
- Goal ids stable across two consecutive `observe` calls (positional carry-over from `prior_goals`).
- Artifact attachment: goal with `send_artifact=true` and valid `artifact_index` → `Goal.attach_artifact_id` resolves to a real `art:` handle from hits.

---

## Step 7 — `decision.py`

**Exit:**
- Goal "fetch wikipedia page for X", no attachment → `DecisionOutput` with `tool_call.name == "fetch_url"`.
- Goal "extract dates from this article" with artifact bytes attached → `DecisionOutput` with `answer`, no tool call. Answer must be substantive: ≥3 sentences, or ≥3 list items, or ≥3 inline enumerated entries (e.g. comma-separated with annotations).
- Goal with indexed corpus in memory hits → either `tool_call.name == "search_knowledge"` OR a direct answer synthesised from chunk previews already in memory hits. Must NOT call `fetch_url`, `web_search`, or `read_file` (no re-fetch of already-indexed content).
- Exactly one of `answer`/`tool_call` populated every call.

---

## Step 8 — MCP server + test suite

Run existing suite; fix any failures; add missing coverage for S7 tools.

Known issue to fix: `test_list_dir` asserts `isinstance(data, list)` but `list_dir` returns `dict` with `count`/`names`/`entries`. Test must be corrected to match the actual contract.

Missing tests to add (marked `@pytest.mark.embed`):
- `index_document("papers/attention.md")` → `chunks_indexed >= 1`.
- `search_knowledge("self-attention mechanism", k=3)` after indexing → list of ≥1 dicts with `descriptor` and `chunk_preview`.
- Sandbox escape on `index_document("../foo")` → error.

**Exit:**
- `uv run pytest` (no markers) — all pass, no errors.
- `uv run pytest -m embed` — index + search tests pass (requires gateway + Ollama).

---

## Step 9 — Query A (Shannon Wikipedia)

Clean state before run.

```
Fetch https://en.wikipedia.org/wiki/Claude_Shannon and tell me his
birth date, death date, and three key contributions to information theory.
```

**Exit:**
- Final answer contains **April 30, 1916** + **February 24, 2001** + 3 contributions.
- Iterations ≤ 6 (2× expected 3).
- History shows artifact attach on the extraction goal.

---

## Step 10 — Query B (Tokyo activities and weather)

Clean state.

```
Find 3 family-friendly things to do in Tokyo this weekend.
Check Saturday's weather forecast there and tell me which one is most appropriate.
```

**Exit:**
- Final answer names 1 activity, justified by weather.
- Iterations ≤ 16 (2× expected 8).
- Weather `tool_outcome` from iteration N appears in memory hits at iteration N+1 and informs the synthesis goal.

---

## Step 11 — Query C (Mom's birthday — durable memory across runs)

Clean state. Two runs against same `state/`.

```
Run 1: My mom's birthday is 15 May 2026. Remember that and create
       reminders for two weeks before and on the day.
Run 2: When is mom's birthday?
```

**Exit:**
- Run 1: reminders created in `sandbox/`; iterations ≤ 8 (2× expected 4).
- `state/memory.json` after run 1 holds `fact` item with the date; `state/index.faiss` non-empty.
- Run 2: answers **15 May 2026**; iterations ≤ 6 (2× expected 3); zero tool calls (answered from FAISS index).

---

## Step 12 — Query D (asyncio synthesis)

Clean state.

```
Search for "Python asyncio best practices", read the top 3 results,
and give me a short numbered list of the advice they agree on.
```

**Exit:**
- Final answer is a numbered list of ≥3 agreed points.
- Iterations ≤ 12 (2× expected 6).
- ≥2 artifacts created from fetches; synthesis goal received an artifact attachment.

---

## Step 13 — Query E (single-document index and extract)

Clean state.

```
Index the file papers/attention.md and tell me what the three key
contributions of the Transformer architecture are according to this paper.
```

**Exit:**
- `index_document` dispatched on iteration 1.
- Final answer names ≥3 contributions (self-attention, parallel computation, positional encoding or equivalent).
- Iterations ≤ 10 (2× expected 5).

---

## Step 14 — Query F (cross-run document recall)

Clean state. Two runs.

```
Run 1: Index every .md file under papers/. Confirm how many chunks were indexed in total.
Run 2 (fresh process, persisted state):
       Across the papers I have indexed, what do they say about chain-of-thought reasoning?
```

**Exit:**
- Run 1: five `index_document` calls; final answer states chunk count; iterations ≤ 22 (2× expected 11).
- Run 2: FAISS index loaded from disk; final answer addresses chain-of-thought; iterations ≤ 6 (2× expected 3); zero `index_document` calls.

---

## Step 15 — Query G (synonym recall — vector beats keyword)

State = persisted corpus from Step 14 Run 1.

```
Across these papers, how do they handle the credit assignment problem?
```

**Exit:**
- Final answer references ≥3 papers.
- Iterations ≤ 8 (2× expected 4).
- Confirm: `grep "credit assignment" sandbox/papers/*.md` returns nothing — keyword search would fail, vector search succeeds.

---

## Step 16 — Query H (cross-document synthesis)

State = persisted corpus from Step 14 Run 1.

```
Compare how the ReAct paper and the Chain-of-Thought paper differ
in their treatment of intermediate reasoning.
```

**Exit:**
- Final answer explicitly contrasts ReAct (interleaved reasoning + actions) vs CoT (linear stepwise reasoning).
- Iterations ≤ 6 (2× expected 3).
- `search_knowledge` called with both-paper scope; no URL re-fetch.

---

## Step 17 — RAG application (open corpus)

Define corpus and domain when reaching this step. Minimum: 50 indexable items.

Requirements carried into this step:
- Agent correctly answers queries that require retrieval (fails without the index).
- At least 2 of the 5 custom queries require semantic recall — query words absent from chunks that answer it.
- Architectural invariant holds: `grep perception.py` still returns zero MCP tool names in SYSTEM.

**Exit:** defined at step entry once corpus is chosen.

---

## Step 18 — Five custom queries

Design after corpus is indexed (Step 17).

**Exit:**
- 5 queries, each with: correct answer WITH index, demonstrable failure WITHOUT index.
- ≥2 queries where query vocabulary does not appear in the answering chunks (semantic recall).
- Each query passes within 2× the observed iteration count on first successful run.

---

## Step 19 — Deliverables

**Exit:**
- `git status` — `state/` untracked-ignored.
- `README.md` has: corpus manifest, eight base query traces (A–H), five custom traces with no-corpus comparison runs.
- GitHub repo public, all files committed.
- Video recorded (out of scope for this plan).
