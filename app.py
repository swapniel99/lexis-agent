"""app.py

FastAPI backend server for LEXIS-RAG: Indian Corporate & Real Estate Legal Intelligence Command Center.
Integrates S7 agent loop, live console log streaming (SSE), legal corpus management, and FAISS indexing.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Add current dir to path to import memory, mcp_server, vector_index
sys.path.insert(0, str(Path(__file__).parent))
import memory as _memory
import mcp_server as _mcp_server
from vector_index import VectorIndex

app = FastAPI(
    title="LEXIS-RAG Indian Legal Intelligence Center",
    description="Professional Legal RAG Assistant powered by Session 7 Agentic Architecture",
    version="1.0.0"
)

# CORS enabled for easy local pairing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

DOCS_DIR = Path(__file__).parent / "sandbox" / "real_documents"
STATE_DIR = Path(__file__).parent / "state"

class QueryRequest(BaseModel):
    query: str

class IndexRequest(BaseModel):
    path: str

# Helper to read title from markdown
def _get_doc_title(file_path: Path) -> str:
    try:
        content = file_path.read_text(encoding="utf-8")
        for line in content.splitlines():
            if line.startswith("# "):
                return line.replace("# ", "").strip()
    except Exception:
        pass
    return file_path.stem.replace("_", " ").title()

# ── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/api/documents")
def get_documents():
    """List all 50 real Indian legal documents in the sandbox."""
    if not DOCS_DIR.exists():
        return {"documents": [], "count": 0}
    
    docs = []
    for child in sorted(DOCS_DIR.iterdir()):
        if child.suffix == ".md":
            # Extract category from ID prefix
            category = "Corporate & Insolvency Law" if child.name.startswith("corp_") else "Real Estate & Property Law"
            # Get ID
            doc_id = child.name.split("_")[0] + "_" + child.name.split("_")[1] if "_" in child.name else child.stem
            
            docs.append({
                "filename": child.name,
                "id": doc_id,
                "title": _get_doc_title(child),
                "category": category,
                "size_bytes": child.stat().st_size
            })
    return {"documents": docs, "count": len(docs)}


@app.get("/api/document/{filename}")
def get_document(filename: str):
    """Read a specific document's raw markdown content."""
    safe_path = (DOCS_DIR / filename).resolve()
    base_dir = DOCS_DIR.resolve()
    if base_dir not in safe_path.parents and safe_path != base_dir:
        raise HTTPException(status_code=400, detail="Invalid path escape attempt")
    
    if not safe_path.exists():
        raise HTTPException(status_code=404, detail="Document not found")
        
    return {
        "filename": filename,
        "title": _get_doc_title(safe_path),
        "content": safe_path.read_text(encoding="utf-8")
    }


@app.post("/api/index")
def index_document(payload: IndexRequest):
    """Programmatically index a document using the S7 mcp_server indexing function."""
    try:
        # Check path: could be a relative path or starting with art:
        doc_path = payload.path
        if not doc_path.startswith("art:"):
            # Ensure it resolves in sandbox
            relative_path = Path("real_documents") / Path(doc_path).name
            doc_path = str(relative_path)
            
        result = _mcp_server.index_document(doc_path)
        return {"ok": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/index-all")
def index_all_documents(background_tasks: BackgroundTasks):
    """Trigger background indexing of all 50 documents for first-time RAG setup."""
    if not DOCS_DIR.exists():
        raise HTTPException(status_code=404, detail="No documents directory found")
    
    def _run_bulk_indexing():
        for child in sorted(DOCS_DIR.iterdir()):
            if child.suffix == ".md":
                try:
                    rel_path = f"real_documents/{child.name}"
                    _mcp_server.index_document(rel_path)
                except Exception as e:
                    print(f"[Bulk Indexing] Error indexing {child.name}: {e}")
                    
    background_tasks.add_task(_run_bulk_indexing)
    return {"ok": True, "message": "Bulk indexing of all 50 documents started in the background"}


@app.get("/api/memory")
def get_memory_state():
    """Retrieve all facts/outcomes stored in state/memory.json for memory mapping."""
    memory_file = STATE_DIR / "memory.json"
    if not memory_file.exists():
        return {"items": [], "count": 0, "vectors_count": 0}
        
    try:
        items = json.loads(memory_file.read_text(encoding="utf-8"))
        idx = VectorIndex(STATE_DIR)
        
        # Strip large embeddings for light payload
        cleaned_items = []
        for it in items:
            cleaned_items.append({
                "id": it.get("id"),
                "kind": it.get("kind"),
                "descriptor": it.get("descriptor"),
                "source": it.get("source"),
                "run_id": it.get("run_id"),
                "value": {k: v for k, v in it.get("value", {}).items() if k != "chunk"}
            })
            
        return {
            "items": cleaned_items,
            "count": len(cleaned_items),
            "vectors_count": idx.size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read memory: {e}")


@app.post("/api/clear")
def clear_session_state():
    """Wipe session memories (preferences, queries, outcomes), artifacts, and temporary text files, keeping indexed facts intact."""
    try:
        # 1. Load memory items and keep ONLY 'fact' items (the indexed documents)
        items = _memory._load()
        fact_items = [i for i in items if i.kind == "fact"]
        _memory._save(fact_items)
        
        # 2. Rebuild the FAISS index to exclude any deleted outcome/preference vectors
        idx = VectorIndex(STATE_DIR)
        idx.clear()
        for item in fact_items:
            if item.embedding is not None:
                idx.add(item.id, item.embedding)
        if idx.size > 0:
            idx.persist()
            
        # 3. Delete state artifacts directory recursively (wipes session files)
        artifacts_dir = STATE_DIR / "artifacts"
        if artifacts_dir.exists():
            import shutil
            shutil.rmtree(artifacts_dir)
            artifacts_dir.mkdir(exist_ok=True)
            
        # 4. Clear any temporary .txt files in the sandbox directory
        sandbox_dir = Path(__file__).parent / "sandbox"
        if sandbox_dir.exists():
            for child in sandbox_dir.iterdir():
                if child.suffix == ".txt":
                    try:
                        child.unlink()
                    except Exception:
                        pass
                        
        return {"ok": True, "message": "Session state wiped clean (indexed legal documents preserved, active conversation cleared)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clear-faiss")
def clear_faiss_index():
    """Completely wipe the FAISS vector index and remove all indexed facts from memory."""
    try:
        _memory.clear()
        return {"ok": True, "message": "FAISS vector index and all indexed facts wiped clean"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/query")
async def run_agent_query(payload: QueryRequest):
    """
    Runs the agent7.py cognitive loop as a subprocess in UNBUFFERED mode (-u),
    capturing and streaming the full step-by-step console logs to the UI live
    using Server-Sent Events (SSE).
    """
    query_str = payload.query

    async def _event_generator():
        # Spawn agent7.py as an external process with -u for unbuffered live streaming
        cmd = [sys.executable, "-u", "agent7.py", query_str]
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(Path(__file__).parent)
            )
            
            # Read stdout line-by-line and yield it
            while True:
                line_bytes = await process.stdout.readline()
                if not line_bytes:
                    break
                line = line_bytes.decode("utf-8", errors="replace")
                
                # Check for final answers or markers to enrich payload
                yield f"data: {json.dumps({'type': 'log', 'text': line})}\n\n"
                await asyncio.sleep(0.01)  # small breathing room
                
            await process.wait()
            yield f"data: {json.dumps({'type': 'done', 'code': process.returncode})}\n\n"
            
        except Exception as err:
            yield f"data: {json.dumps({'type': 'error', 'text': str(err)})}\n\n"

    return StreamingResponse(_event_generator(), media_type="text/event-stream")


# ── Serve static files ──────────────────────────────────────────────────────

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

# Mount frontend files
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
