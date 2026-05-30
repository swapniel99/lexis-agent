/* ── LEXIS-RAG SYSTEM LOGIC ─────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
    // ── DOM ELEMENTS ──────────────────────────────────────────────────────
    const queryInput = document.getElementById("query-input");
    const btnSubmit = document.getElementById("btn-submit");
    const btnClear = document.getElementById("btn-clear");
    const btnClearTerminal = document.getElementById("btn-clear-terminal");
    const btnIndexAll = document.getElementById("btn-index-all");
    const btnClearFaiss = document.getElementById("btn-clear-faiss");
    const terminalScreen = document.getElementById("terminal-screen");
    const librarySearch = document.getElementById("library-search");
    const memorySearch = document.getElementById("memory-search");
    const corpDocsList = document.getElementById("corp-docs-list");
    const reDocsList = document.getElementById("re-docs-list");
    const vectorGrid = document.getElementById("vector-grid");

    // Status metrics
    const statVectors = document.getElementById("faiss-vectors");
    const statVectorsLbl = document.getElementById("vectors-stat-lbl");
    const statDocsCount = document.getElementById("corpus-count");

    // Modal
    const docModal = document.getElementById("doc-modal");
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");
    const modalClose = document.getElementById("modal-close");

    // Dynamic state
    let allDocumentsList = [];
    let memoryFactsList = [];
    let isAgentRunning = false;
    let isCollectingFinal = false;
    let finalAnswerLines = [];

    // ── CORE API CALLS ────────────────────────────────────────────────────

    // 1. Fetch and render document library
    async function fetchLibrary() {
        try {
            const resp = await fetch("/api/documents");
            const data = await resp.json();
            allDocumentsList = data.documents || [];

            // Render list
            renderLibraryList(allDocumentsList);
            updateLibraryMetrics();
        } catch (err) {
            console.error("Failed to load legal library:", err);
            corpDocsList.innerHTML = `<div class="err-line">Error loading library documents.</div>`;
        }
    }

    // 2. Fetch and render FAISS Memory State
    async function fetchMemoryState() {
        try {
            const resp = await fetch("/api/memory");
            const data = await resp.json();
            memoryFactsList = data.items || [];

            statVectors.innerText = `${data.vectors_count} VECTORS`;
            statVectorsLbl.innerText = `${data.vectors_count} vectors loaded in FAISS`;

            renderMemoryGrid(memoryFactsList);
            updateLibraryMetrics();
        } catch (err) {
            console.error("Failed to load FAISS state:", err);
        }
    }

    // Helper to calculate and update document library index status in HUD
    function updateLibraryMetrics() {
        if (!allDocumentsList || !allDocumentsList.length) return;
        const indexedDocsCount = allDocumentsList.filter(doc => 
            memoryFactsList.some(fact => fact.value && fact.value.source && fact.value.source.includes(doc.filename))
        ).length;
        statDocsCount.innerText = `${indexedDocsCount} / ${allDocumentsList.length} INDEXED`;
    }

    // 3. Clear session state (preserving FAISS index)
    async function clearState() {
        if (!confirm("WIPE STATE: This will clear the active conversation session, preferences, intermediate outcomes, and temporary files. Indexed documents and the FAISS vector index will be preserved. Are you sure?")) {
            return;
        }

        appendTerminalLine("\n>> [WIPE STATE] Wiping active session/conversation state (preserving FAISS index)...", "err-line");
        try {
            const resp = await fetch("/api/clear", { method: "POST" });
            const data = await resp.json();

            appendTerminalLine(`>> [WIPE STATE] ${data.message}`, "system-line");

            // Reload
            await fetchMemoryState();
            await fetchLibrary();
        } catch (err) {
            appendTerminalLine(`>> [WIPE STATE] Wiping failed: ${err}`, "err-line");
        }
    }

    // 3.5. Clear FAISS Vector Index completely
    async function clearFaissIndex() {
        if (!confirm("WIPE INDEX: This will permanently delete the FAISS vector index and all indexed documents from vector memory. You will need to re-index documents to use RAG features. Are you sure?")) {
            return;
        }

        appendTerminalLine("\n>> [WIPE INDEX] Wiping FAISS vector store and all legal document vector index facts...", "err-line");
        try {
            const resp = await fetch("/api/clear-faiss", { method: "POST" });
            const data = await resp.json();

            appendTerminalLine(`>> [FAISS WIPE] ${data.message}`, "system-line");

            // Reload
            await fetchMemoryState();
            await fetchLibrary();
        } catch (err) {
            appendTerminalLine(`>> [FAISS WIPE] Wiping failed: ${err}`, "err-line");
        }
    }

    // ── RENDERERS ─────────────────────────────────────────────────────────

    // Render library files grouped by category
    function renderLibraryList(docs) {
        const filterText = librarySearch.value.toLowerCase().strip ? librarySearch.value.toLowerCase().trim() : "";

        // Filter docs
        const filteredDocs = docs.filter(doc =>
            doc.title.toLowerCase().includes(filterText) ||
            doc.id.toLowerCase().includes(filterText) ||
            doc.category.toLowerCase().includes(filterText)
        );

        const corpList = filteredDocs.filter(d => d.category.startsWith("Corporate"));
        const reList = filteredDocs.filter(d => d.category.startsWith("Real Estate"));

        // Render corporate docs
        if (corpList.length === 0) {
            corpDocsList.innerHTML = `<div class="system-line">No matching corporate documents.</div>`;
        } else {
            corpDocsList.innerHTML = corpList.map(doc => createDocCardMarkup(doc)).join("");
        }

        // Render real estate docs
        if (reList.length === 0) {
            reDocsList.innerHTML = `<div class="system-line">No matching real estate documents.</div>`;
        } else {
            reDocsList.innerHTML = reList.map(doc => createDocCardMarkup(doc)).join("");
        }

        // Bind events to buttons
        bindCardActions();
    }

    // Helper to generate doc card markup
    function createDocCardMarkup(doc) {
        // Check if already indexed based on FAISS facts
        const isIndexed = memoryFactsList.some(fact => fact.value && fact.value.source && fact.value.source.includes(doc.filename));
        const indexClass = isIndexed ? "indexed" : "";
        const indexTitle = isIndexed ? "Document indexed in FAISS" : "Click to chunk and index in FAISS";

        return `
            <div class="doc-card">
                <div class="doc-info">
                    <span class="doc-title" title="${doc.title}">${doc.title}</span>
                </div>
                <div class="doc-actions">
                    <button class="btn-icon btn-view" data-filename="${doc.filename}" title="View Document text">
                        <i class="fa-solid fa-file-lines"></i>
                    </button>
                    <button class="btn-icon btn-index ${indexClass}" data-filename="${doc.filename}" title="${indexTitle}">
                        <i class="fa-solid fa-network-wired"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Bind action events on doc cards
    function bindCardActions() {
        document.querySelectorAll(".btn-view").forEach(btn => {
            btn.onclick = async (e) => {
                const filename = btn.getAttribute("data-filename");
                await showDocDetails(filename);
            };
        });

        document.querySelectorAll(".btn-index").forEach(btn => {
            btn.onclick = async (e) => {
                const filename = btn.getAttribute("data-filename");
                btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
                await indexSingleDocument(filename, btn);
            };
        });
    }

    // Index a single document manually
    async function indexSingleDocument(filename, btnElement) {
        appendTerminalLine(`\n>> [FAISS] Dispatching indexing request for real_documents/${filename}...`, "system-line");
        try {
            const resp = await fetch("/api/index", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: filename })
            });
            const data = await resp.json();

            if (data.ok) {
                appendTerminalLine(`>> [FAISS] Success! Chunks indexed: ${data.result.chunks_indexed} (Overlap: ${data.result.overlap} words)`, "a-line");
                // Reload
                await fetchMemoryState();
                await fetchLibrary();
            } else {
                appendTerminalLine(`>> [FAISS] Indexing failed: ${data.detail}`, "err-line");
                btnElement.innerHTML = `<i class="fa-solid fa-network-wired"></i>`;
            }
        } catch (err) {
            appendTerminalLine(`>> [FAISS] Network error: ${err}`, "err-line");
            btnElement.innerHTML = `<i class="fa-solid fa-network-wired"></i>`;
        }
    }

    // Show document markdown detail modal
    async function showDocDetails(filename) {
        try {
            const resp = await fetch(`/api/document/${filename}`);
            const data = await resp.json();

            modalTitle.innerText = data.title;
            // Simple helper to compile raw markdown to HTML structures for nice viewing
            modalBody.innerHTML = compileSimpleMarkdown(data.content);

            docModal.style.display = "flex";
        } catch (err) {
            alert(`Failed to load document: ${err}`);
        }
    }

    // Tab content switcher
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

            btn.classList.add("active");
            const tabName = btn.getAttribute("data-tab");
            document.getElementById(`tab-${tabName}`).classList.add("active");
        };
    });

    // Render FAISS Vector Memory Explorer
    function renderMemoryGrid(items) {
        const filterText = memorySearch.value.toLowerCase().trim();

        const filteredItems = items.filter(item =>
            item.descriptor.toLowerCase().includes(filterText) ||
            item.kind.toLowerCase().includes(filterText) ||
            item.id.toLowerCase().includes(filterText)
        );

        if (filteredItems.length === 0) {
            vectorGrid.innerHTML = `
                <div class="no-vectors-placeholder">
                    <i class="fa-solid fa-folder-open"></i>
                    <p>No matching vectors in memory search.</p>
                </div>
            `;
            return;
        }

        vectorGrid.innerHTML = filteredItems.map(item => {
            const kindClass = item.kind === "fact" ? "kind-fact" : item.kind === "tool_outcome" ? "kind-outcome" : "kind-preference";
            const kindLabel = item.kind === "tool_outcome" ? "OUTCOME" : item.kind.toUpperCase();

            return `
                <div class="vector-card ${item.kind}">
                    <div class="vector-card-header">
                        <span class="vector-kind ${kindClass}">${kindLabel}</span>
                        <span class="vector-id">${item.id}</span>
                    </div>
                    <div class="vector-desc">${item.descriptor}</div>
                    <div class="vector-source">
                        <span>Source: ${item.source || 'agent'}</span>
                        <span>Run: ${item.run_id}</span>
                    </div>
                </div>
            `;
        }).join("");
    }

    // ── AGENT QUERY DISPATCH (STREAMING READ) ─────────────────────────────

    async function dispatchQuery(queryText) {
        if (isAgentRunning) return;
        isAgentRunning = true;

        isCollectingFinal = false;
        finalAnswerLines = [];

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> RUNNING`;
        queryInput.disabled = true;

        appendTerminalLine(`\n═ DISPATCHING LEGAL RESEARCH COMMISSION ═════════════════════════════════════`, "header-line");
        appendTerminalLine(`Query: "${queryText}"`, "header-line");
        appendTerminalLine(`moratorium_check = active; faiss_retriever = online; cognitive_roles = active\n`, "system-line");

        try {
            // Using modern fetch ReadableStream to read the POST response line-by-line in real-time
            const response = await fetch("/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: queryText })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                // Save last partial line back to buffer
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const rawData = JSON.parse(line.replace("data: ", ""));
                            if (rawData.type === "log") {
                                colorCodeAndAppend(rawData.text);
                            } else if (rawData.type === "error") {
                                appendTerminalLine(`>> [PROCESS ERROR] ${rawData.text}`, "err-line");
                            }
                        } catch (e) {
                            // Suppress JSON parse failures on keep-alive/corrupt chunks
                        }
                    }
                }
            }

            // Flush collected final answer if still in progress
            if (isCollectingFinal) {
                isCollectingFinal = false;
                const fullText = finalAnswerLines.join("\n").trim();
                const compiledHtml = compileSimpleMarkdown(fullText);
                appendTerminalHtml(`\n<div class="resolution-card"><h3 class="resolution-title"><i class="fa-solid fa-square-poll-horizontal text-gold"></i> FINAL RESOLUTION</h3>${compiledHtml}</div>\n`, "header-line");
            }

            appendTerminalLine(`\n═ COMMISSION RESOLVED AND DURABLY persistED ═══════════════════════════════`, "header-line");

            // Reload FAISS state and index highlights
            await fetchMemoryState();
            await fetchLibrary();

        } catch (err) {
            appendTerminalLine(`\n>> [DISPATCH ERROR] Commission failed: ${err}`, "err-line");
        } finally {
            isAgentRunning = false;
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span class="btn-text">DISPATCH</span> <i class="fa-solid fa-arrow-right"></i>`;
            queryInput.disabled = false;
            queryInput.value = "";
            queryInput.focus();
        }
    }

    // ── TERMINAL FORMATTERS & ANIMATIONS ──────────────────────────────────

    function appendTerminalLine(text, className = "") {
        const lineEl = document.createElement("div");
        lineEl.className = `terminal-line ${className}`;
        lineEl.textContent = text;
        terminalScreen.appendChild(lineEl);

        // Auto scroll to bottom
        terminalScreen.scrollTop = terminalScreen.scrollHeight;
    }

    function appendTerminalHtml(html, className = "") {
        const lineEl = document.createElement("div");
        lineEl.className = `terminal-line ${className}`;
        lineEl.innerHTML = html;
        terminalScreen.appendChild(lineEl);

        // Auto scroll to bottom
        terminalScreen.scrollTop = terminalScreen.scrollHeight;
    }

    // Parse standard agent print statements and apply HUD colors
    function colorCodeAndAppend(rawLine) {
        const line = rawLine.trim();
        
        // If we are currently collecting the final answer
        if (isCollectingFinal) {
            if (line.startsWith("══")) {
                // End collection and render the card!
                isCollectingFinal = false;
                const fullText = finalAnswerLines.join("\n").trim();
                const compiledHtml = compileSimpleMarkdown(fullText);
                appendTerminalHtml(`\n<div class="resolution-card"><h3 class="resolution-title"><i class="fa-solid fa-square-poll-horizontal text-gold"></i> FINAL RESOLUTION</h3>${compiledHtml}</div>\n`, "header-line");
                return;
            }
            // Preserve blank lines or append content
            if (!rawLine.trim()) {
                finalAnswerLines.push("");
            } else {
                finalAnswerLines.push(rawLine.trimEnd());
            }
            return;
        }

        if (!line) return;

        // 1. DISCARD redundant / low-signal lines
        if (line.startsWith("══")) return; // skip raw horizontal dividers
        if (line.startsWith("[mcp] loaded")) return; // skip initial tool list load
        if (line.startsWith("run ") && line.includes("query:")) return; // skip duplicate run headers

        // Filter completed goals (✓) to prevent terminal cluttering as iterations grow
        if (line.startsWith("[perception]") && line.includes("✓")) return;

        // 2. Format high-signal logs beautifully
        if (line.startsWith("─── iter")) {
            appendTerminalLine(`\n${line}`, "header-line");
            return;
        }

        if (line.startsWith("FINAL:")) {
            isCollectingFinal = true;
            finalAnswerLines = [rawLine.replace("FINAL:", "").trimEnd()];
            return;
        }

        if (line.startsWith("[perception]")) {
            // Display active target goals
            appendTerminalLine(line.replace("[perception]", "[Perception]"), "p-line");
        } else if (line.startsWith("[decision]")) {
            appendTerminalLine(line.replace("[decision]", "[Decision]  "), "d-line");
        } else if (line.startsWith("[action]")) {
            appendTerminalLine(line.replace("[action]", "[Action]    "), "a-line");
        } else if (line.startsWith("[memory.read]")) {
            appendTerminalLine(line.replace("[memory.read]", "[Memory]    "), "m-line");
        } else if (line.startsWith("[attach]")) {
            appendTerminalLine(line.replace("[attach]", "[Context]   "), "m-line");
        } else if (line.startsWith("[done]")) {
            appendTerminalLine(`\n>> ${line.toUpperCase()}`, "header-line");
        } else {
            // Forward other relevant progress info
            if (!line.includes("[memory.remember]") && !line.includes("[memory.record_outcome]")) {
                appendTerminalLine(line, "system-line");
            }
        }
    }

    // ── AUXILIARY HELPERS ─────────────────────────────────────────────────

    // Bulk index trigger
    btnIndexAll.onclick = async () => {
        if (!confirm("Are you sure you want to index all 50 landmark Indian legal cases in the background? This will run vector embeddings for each chunk.")) {
            return;
        }

        btnIndexAll.disabled = true;
        btnIndexAll.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> INDEXING...`;
        appendTerminalLine("\n>> [BULK INDEX] Triggered background indexing of all 50 documents...", "system-line");

        try {
            const resp = await fetch("/api/index-all", { method: "POST" });
            const data = await resp.json();

            appendTerminalLine(`>> [BULK INDEX] ${data.message}. Watching vectors increase in HUD metrics.`, "a-line");

            // Poll memory state every 3 seconds to update the stats
            let pollCount = 0;
            const interval = setInterval(async () => {
                await fetchMemoryState();
                pollCount++;
                if (pollCount >= 10) { // stop polling after 30 seconds
                    clearInterval(interval);
                    btnIndexAll.disabled = false;
                    btnIndexAll.innerHTML = `<i class="fa-solid fa-bolt"></i> INDEX ALL 50 DOCS`;
                }
            }, 3000);

        } catch (err) {
            appendTerminalLine(`>> [BULK INDEX] Request failed: ${err}`, "err-line");
            btnIndexAll.disabled = false;
            btnIndexAll.innerHTML = `<i class="fa-solid fa-bolt"></i> INDEX ALL 50 DOCS`;
        }
    };

    // Filter library lists live
    librarySearch.oninput = () => renderLibraryList(allDocumentsList);

    // Filter vector memory list live
    memorySearch.oninput = () => renderMemoryGrid(memoryFactsList);

    // Dynamic Suggestion Chips
    document.querySelectorAll(".chip").forEach(chip => {
        chip.onclick = () => {
            const query = chip.getAttribute("data-query");
            queryInput.value = query;
            queryInput.focus();
        };
    });

    // Clear Terminal Screen
    btnClearTerminal.onclick = () => {
        terminalScreen.innerHTML = `
            <div class="terminal-line system-line">> Terminal screen cleared.</div>
            <div class="terminal-line system-line">> Enter custom legal query to inspect loops.</div>
        `;
    };

    // Wipe global state
    btnClear.onclick = () => clearState();

    // Wipe FAISS index completely
    btnClearFaiss.onclick = () => clearFaissIndex();

    // Query Dispatch Triggers
    btnSubmit.onclick = () => {
        const text = queryInput.value.trim();
        if (text) dispatchQuery(text);
    };

    queryInput.onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); // prevent new line from being added
            const text = queryInput.value.trim();
            if (text && !isAgentRunning) dispatchQuery(text);
        }
    };

    // Modal Close triggers
    modalClose.onclick = () => docModal.style.display = "none";
    window.onclick = (e) => {
        if (e.target === docModal) {
            docModal.style.display = "none";
        }
    };

    // Simple parser to make raw markdown look clean and structured in detail view and terminal resolution
    function compileSimpleMarkdown(md) {
        // First, extract tables
        let lines = md.split("\n");
        let result = [];
        let inTable = false;
        let tableRows = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line.startsWith("|") && line.endsWith("|")) {
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(line);
            } else {
                if (inTable) {
                    // Process tableRows
                    result.push(renderTableHTML(tableRows));
                    inTable = false;
                }
                result.push(line);
            }
        }
        if (inTable) {
            result.push(renderTableHTML(tableRows));
        }

        // Now process the rest of markdown formatting
        let content = result.join("\n");
        return content
            .replace(/### (.*?)(?:\n|$)/g, "<h3>$1</h3>")
            .replace(/## (.*?)(?:\n|$)/g, "<h2>$1</h2>")
            .replace(/# (.*?)(?:\n|$)/g, "<h1>$1</h1>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/-\s+(.*?)(?:\n|$)/gm, "<li>$1</li>")
            .replace(/(?:<li>.*?<\/li>\n?)+/gs, "<ul>$&</ul>")
            .replace(/---\n/g, "<hr>")
            .split("\n\n").map(p => {
                if (p.trim().startsWith("<h") || p.trim().startsWith("<hr") || p.trim().startsWith("<table") || p.trim().startsWith("<ul") || p.trim().startsWith("<li")) return p;
                return `<p>${p.trim().replace(/\n/g, "<br>")}</p>`;
            }).join("");
    }

    function renderTableHTML(rows) {
        if (rows.length < 1) return "";
        let html = '<div class="table-container"><table class="hud-table">';
        
        let startIdx = 0;
        // Check if there is a header separator (e.g. |---|---|)
        let hasSeparator = rows.length > 1 && (rows[1].includes("---") || rows[1].includes("==="));
        
        for (let i = 0; i < rows.length; i++) {
            let cells = rows[i].split("|").map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            
            // Skip separator line
            if (rows[i].includes("---") || rows[i].includes("===")) {
                continue;
            }
            
            if (i === 0) {
                html += "<thead><tr>" + cells.map(c => `<th>${c}</th>`).join("") + "</tr></thead><tbody>";
            } else {
                html += "<tr>" + cells.map(c => `<td>${c}</td>`).join("") + "</tr>";
            }
        }
        
        html += "</tbody></table></div>";
        return html;
    }

    // ── COLD BOOT ─────────────────────────────────────────────────────────
    (async () => {
        await fetchMemoryState();
        await fetchLibrary();
    })();
});
