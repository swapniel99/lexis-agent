# LEXIS-RAG: Indian Corporate & Real Estate Legal Intelligence

LEXIS-RAG is a professional, high-stakes RAG (Retrieval-Augmented Generation) application designed for lawyers, law students, and real estate developers. It utilizes the robust **Four-role cognitive architecture** (Perception → Decision → Action → Memory) coupled with a **FAISS vector database** to index and query landmark judgments under Indian corporate, securities, and property laws.

The application features a stunning, modern **obsidian-dark glassmorphic dashboard** with a live retro-terminal streaming logs of the agent's cognitive loops, alongside a dynamic FAISS vector memory map.

## 📂 Seminal Indian Legal Corpus Manifest

The complete registry of the 50 Indian corporate and real estate landmark cases indexed in the RAG system can be found in the standalone manifest file:
👉 **[Seminal Indian Legal Corpus Manifest (50 Documents)](file:///Users/swapniel/git/S7code/corpus_manifest.md)**

---

## 🎨 Key Features

1. **Futuristic HUD Console Dashboard**:
   * **Real-Time Log Stream**: A color-coded command terminal showing live logs of the agent's four roles (`Perception` goal-tracking, `Decision` tool-calling, `Action` executions, and `Memory` vector readings) as they run!
   * **Durable FAISS Memory Map**: Visualizes the vector space elements (facts and outcomes) stored in the agent's FAISS index, with live search filters.
   * **Interactive Library**: Browse the 50 case briefs, inspect their text in a styled modal, and trigger manual vector indexing.
3. **Dynamic Chat Ingestion**:
   * Paste any legal document URL directly in the chat prompt (e.g., *"Read https://www.barandbench.com/news/case-abc and save it and index it for search, then tell me if NCLT has power to..."*). The agent will automatically call `fetch_url`, convert it to markdown, save it as an artifact, execute `index_document`, and answer your query using RAG!

---

## 🚀 How to Run the Application

### Prerequisites
* Ensure your local LLM Gateway is running on `http://localhost:8107`.
* Start Ollama locally with `nomic-embed-text-v2-moe:latest` or configure the Gemini slices in the gateway.

### Step-by-Step Launch
1. **Navigate to the workspace**:
   ```bash
   cd /Users/swapniel/git/S7code
   ```

2. **Activate the virtual environment**:
   ```bash
   source .venv/bin/activate
   ```

3. **Install any new dependencies (FastAPI, Uvicorn)**:
   ```bash
   uv pip install fastapi uvicorn
   ```

4. **Start the FastAPI Web Server**:
   ```bash
   uv run uvicorn app:app --port 8000 --host 127.0.0.1 --reload
   ```

5. **Access the Dashboard**:
   Open your browser and visit: **[http://localhost:8000/](http://localhost:8000/)**

---

## ⚡ Indexing the Corpus

* **Pre-Indexed State**: The 50 real Indian legal documents have already been bulk-indexed using `bulk_index.py`, producing exactly **80 FAISS vector chunks** stored on disk!
* **Wiping & Re-indexing**:
  * You can wipe the global state (including FAISS index, memory.json, cached artifacts, and temporary text files) by clicking the **WIPE STATE** button.
  * You can trigger background indexing of all 50 documents at any time by clicking **INDEX ALL 50 DOCS** and watching the vectors increase live in the HUD header!
