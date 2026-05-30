# LEXIS-RAG: Indian Corporate & Real Estate Legal Intelligence Command Center

LEXIS-RAG is a professional, high-stakes RAG (Retrieval-Augmented Generation) application designed for lawyers, law students, and real estate developers. It utilizes the robust **Session 7 four-role cognitive architecture** (Perception → Decision → Action → Memory) coupled with a **FAISS vector database** to index and query landmark judgments under Indian corporate, securities, and property laws.

The application features a stunning, modern **obsidian-dark glassmorphic dashboard** with a live retro-terminal streaming logs of the agent's cognitive loops, alongside a dynamic FAISS vector memory map.

---

## 🎨 Key Features

1. **Seminal Indian Legal Corpus (50 Documents)**:
   * **Corporate & Insolvency Law (25 cases)**: Detailed briefs of landmark Supreme Court and appellate cases under the *Insolvency and Bankruptcy Code (IBC) 2016*, *SEBI securities acts*, and *Companies Act 2013* (e.g. *Swiss Ribbons*, *Essar Steel*, *Tata-Mistry*, *Innoventive Industries*).
   * **Real Estate & Property Law (25 cases)**: Landlord-tenant laws, property title registration guides, and landmark housing cases under the *Real Estate Regulation Act (RERA) 2016* (e.g. *Pioneer Urban*, *Supertech Twin Towers demolition*, *Amrapali Group takeover*).
2. **Futuristic HUD Console Dashboard**:
   * **Real-Time Log Stream**: A color-coded command terminal showing live logs of the agent's four roles (`Perception` goal-tracking, `Decision` tool-calling, `Action` executions, and `Memory` vector readings) as they run!
   * **Durable FAISS Memory Map**: Visualizes the vector space elements (facts and outcomes) stored in the agent's FAISS index, with live search filters.
   * **Interactive Library**: Browse the 50 case briefs, inspect their text in a styled modal, and trigger manual vector indexing.
3. **Dynamic Chat Ingestion**:
   * Paste any legal document URL directly in the chat prompt (e.g., *"Read https://www.barandbench.com/news/case-abc and index it, then tell me if NCLT has power to..."*). The agent will automatically call `fetch_url`, convert it to markdown, save it as an artifact, execute `index_document`, and answer your query using RAG!

---

## ⚖️ 5 Complex Multi-Step Agentic RAG Queries

These five complex queries showcase the stark, massive contrast between querying the LLM **without RAG** vs **with RAG** using the indexed Indian legal corpus. They represent **multi-step agentic workflows** (comparisons, research, cross-run memory, and synonym recall) modeled directly after the S7 standard benchmark queries (C, D, G, H).

### Query I1: Jaypee Infratech Allottees (Multi-Source Research - like Query D)
* **File**: [queries/query_i1.txt](file:///Users/swapniel/git/S7code/queries/query_i1.txt)
* **The Query**:
  > *"Search for 'Jaypee Infratech insolvency case allottees rights under IBC', read the top 3 results, and give me a numbered list of the legal protections for homebuyers that all sources agree on."*
* **❌ Without RAG (Generic LLM)**: Incapable of fetching the internet pages live or will hallucinate old search indexes without proper verification.
* **✅ With RAG (LEXIS-RAG)**: The agent calls **`web_search`** for Jaypee Infratech. It gets search hits. It calls **`fetch_url`** on the top 3 results, saving them as artifacts. It then reads and compares these 3 artifacts to find points of agreement, and synthesizes a numbered summary!

### Query I2: Operational Creditor Voting Rights (Cross-Case Comparison - like Query H)
* **File**: [queries/query_i2.txt](file:///Users/swapniel/git/S7code/queries/query_i2.txt)
* **The Query**:
  > *"Compare how the Swiss Ribbons judgment and the Essar Steel judgment differ in their treatment of Operational Creditors' voting and recovery rights under the IBC. Explain what statutory protections were upheld in each case."*
* **❌ Without RAG (Generic LLM)**: Gives general commercial law definitions, but fails to extract and compare the highly distinct legal arguments from both cases accurately.
* **✅ With RAG (LEXIS-RAG)**: The agent has to run two distinct **`search_knowledge`** calls: one for *Swiss Ribbons* operational creditors, and one for *Essar Steel* operational creditors. It gets chunks from both cases, parses the differences in voting/waterfall priority, and synthesizes a structured comparative study!

### Query I3: Client Consultation Brief (Cross-Run Memory - like Query C)
* **Files**: [queries/query_i3a.txt](file:///Users/swapniel/git/S7code/queries/query_i3a.txt) (Run 1) and [queries/query_i3b.txt](file:///Users/swapniel/git/S7code/queries/query_i3b.txt) (Run 2)
* **The Queries**:
  * **Run 1**: *"My client, a homebuyer named Anita Sen, purchased a flat in Noida under a builder agreement that limits delayed possession interest to Rs 5 per square foot per month. Remember Anita's case and the nominal interest clause."*
  * **Run 2 (Persisted state)**: *"Based on the details of my client Anita Sen's contract dispute, suggest a legal defense strategy and the specific RERA provisions we should invoke to claim a full refund at a 10% rate instead. Cite the relevant case law."*
* **❌ Without RAG (Generic LLM)**: Completely forgets Anita Sen's case details between the two runs and is unable to form a custom defense strategy.
* **✅ With RAG (LEXIS-RAG)**: In Run 1, the agent records Anita's contract facts. In Run 2, the agent reads the query, does a **`memory.read`** to recall Anita's contract facts, and then runs **`search_knowledge`** on RERA Section 18 / *Newtech Promoters* case files to find that one-sided agreements are void. It synthesizes a professional legal defense brief customized for Anita!

### Query I4: Developer-Authority Collusion (Cross-Case Comparison - like Query H)
* **File**: [queries/query_i4.txt](file:///Users/swapniel/git/S7code/queries/query_i4.txt)
* **The Query**:
  > *"Based on the Supertech Noida Twin Towers case and the Amrapali Group case, compare the measures taken by the Supreme Court of India when builders collude with local development authorities to defraud homebuyers."*
* **❌ Without RAG (Generic LLM)**: Speaks in broad moral/ethical terms about corporate responsibility, but misses the unique judicial remedies ordered by the Supreme Court of India.
* **✅ With RAG (LEXIS-RAG)**: The agent runs **`search_knowledge`** for *Supertech* (Noida Authority collusion) and *Amrapali* (lease cancellation and funds diversion). It extracts the different remedies ordered: demolition of illegal towers in Supertech vs cancellation of leases, vesting of properties in court receiver, and takeover by NBCC in Amrapali. It synthesizes a profound comparative study of court remedies for developer-authority collusion!

### Query I5: resurrection of historical liabilities (Semantic Synonym - like Query G)
* **File**: [queries/query_i5.txt](file:///Users/swapniel/git/S7code/queries/query_i5.txt)
* **The Query**:
  > *"Across the corporate insolvency papers, how does Indian law handle the 'resurrection of historical administrative liabilities' once a new management takes control of the bankrupted entity?"*
* **❌ Without RAG (Generic LLM)**: Incapable of matching the custom phrasing to any specific legal framework, giving generic corporate bankruptcy descriptions.
* **✅ With RAG (LEXIS-RAG)**: The phrase "resurrection of historical administrative liabilities" appears in **none** of the indexed chunks. However, the vector search maps this conceptually to the **"Clean Slate Theory"** and prior statutory claims, retrieving chunks from the **Ghanashyam Mishra (2021)** case! The agent explains that under Section 31, once a resolution plan is NCLT-approved, all prior claims and liabilities are completely extinguished and prior statutory claims cannot be resurrected, providing a clean slate!

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
