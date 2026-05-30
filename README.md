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

## ⚖️ 5 Complex RAG vs No-RAG Queries

These five complex queries showcase the stark, massive contrast between querying the LLM **without RAG** vs **with RAG** using the indexed Indian legal corpus.

### Query 1: Secured Bank vs Homebuyers (The IBC waterfall conflict)
* **The Query**:
  > *"If a real estate developer goes insolvent under the IBC, who gets priority to recover their money: a bank holding a registered mortgage on the project land, or the flat buyers who paid advance booking amounts? Support your answer with landmark Supreme Court judgments."*
* **❌ Without RAG (Generic LLM)**: Gives vague consumer protection advice, fails to outline the priorities under the Section 53 waterfall mechanism, or guesses that flat buyers win because they are "consumers".
* **✅ With RAG (LEXIS-RAG)**: Vector search pulls in **Pioneer Urban (2019)** (establishing homebuyers as financial creditors) and **Essar Steel (2019)** (secured vs unsecured priority). It correctly reasons that while homebuyers are indeed financial creditors, they are *unsecured* financial creditors, whereas the bank is a *secured* financial creditor. Therefore, under the Section 53 waterfall, the secured bank still retains priority of recovery over homebuyers!

### Query 2: NCLT vs RERA Jurisdictions (Section 238 overrides)
* **The Query**:
  > *"If a homebuyer wins a RERA refund order for delayed possession, but the builder is subsequently pushed into NCLT insolvency proceedings, can the homebuyer still execute the RERA refund certificate? Explain which Act overrides the other."*
* **❌ Without RAG (Generic LLM)**: Struggles to explain the overlap between the two acts, giving generic guidance to consult a local advocate.
* **✅ With RAG (LEXIS-RAG)**: The agent pulls **Innoventive Industries (2017)** and **Pioneer Urban**. It explains that **Section 238 of the IBC** has an absolute overriding effect. Once a moratorium is declared under **Section 14 of the IBC**, all civil and RERA execution proceedings are strictly stayed. The homebuyer cannot execute their RERA refund and must file a claim as a financial creditor in the Committee of Creditors!

### Query 3: Homebuyers as Financial Borrowers (Semantic recall)
* **The Query**:
  > *"Explain the legal reasoning used by the Supreme Court to justify classifying homebuyers as financial lenders, and how this relates to commercial borrowing principles."*
* **❌ Without RAG (Generic LLM)**: Focuses on "fairness" or protecting consumers, but lacks the technical commercial borrowing thesis.
* **✅ With RAG (LEXIS-RAG)**: The agent pulls the **Pioneer Urban** brief and explains the exact core legal thesis: developers use homebuyers' advance payments to finance the construction of the project, which is a transaction having the **commercial effect of a borrowing** under **Section 5(8)(f)** of the IBC!

### Query 4: Demolition of Supertech Noida Twin Towers
* **The Query**:
  > *"What specific structural and statutory violations did the Supreme Court identify to order the complete demolition of the Noida Twin Towers, and how did Noida Authority officials play a role?"*
* **❌ Without RAG (Generic LLM)**: Gives vague answers like "unauthorized construction" or "safety issues" but completely misses the building codes.
* **✅ With RAG (LEXIS-RAG)**: The agent pulls the **Supertech Twin Towers (2021)** brief. It cites the specific violations: UP Apartments Act 2010 (failure to get the consent of existing flat owners before adding towers), minimum fire safety distance breaches between buildings, and details the **systemic collusion** between Noida Authority officials and the developer to sanction illegal plans.

### Query 5: Media Speculation vs Insider Trading Standards
* **The Query**:
  > *"Can a corporate promoter trade shares in their company during negotiations for a demerger by claiming that the demerger plans were already public knowledge because they were heavily reported in national business media? Cite the SEBI standard."*
* **❌ Without RAG (Generic LLM)**: States it's risky but cannot cite the exact regulatory codes or standard.
* **✅ With RAG (LEXIS-RAG)**: The agent pulls **SEBI v. Kishore Biyani (2023)**. It cites **SEBI (PIT) Regulations 2015** and explains that information is considered **Unpublished Price Sensitive Information (UPSI)** until it is formally disclosed to the stock exchanges. Media speculation is *not* formal publication, and trading based on it is a strict violation!

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
