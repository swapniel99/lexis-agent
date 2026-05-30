"""bulk_index.py

Utility script to index all 50 real Indian legal documents under sandbox/real_documents/
into the FAISS vector index via Session 7 indexing tools.
"""

import sys
from pathlib import Path

# Add current dir to path to import mcp_server, memory, etc.
sys.path.insert(0, str(Path(__file__).parent))
import mcp_server as _mcp_server
import memory as _memory

DOCS_DIR = Path(__file__).parent / "sandbox" / "real_documents"

def main():
    if not DOCS_DIR.exists():
        print(f"Error: Documents directory not found at {DOCS_DIR}")
        sys.exit(1)
        
    print("Clearing prior index and state for a clean slate...")
    _memory.clear()
    
    docs = sorted([child for child in DOCS_DIR.iterdir() if child.suffix == ".md"])
    print(f"Found {len(docs)} documents to index. Beginning chunking and embedding...")
    
    indexed_count = 0
    chunks_count = 0
    
    for i, doc in enumerate(docs, 1):
        rel_path = f"real_documents/{doc.name}"
        print(f"[{i}/{len(docs)}] Indexing {doc.name}...", end="", flush=True)
        try:
            res = _mcp_server.index_document(rel_path)
            chunks_indexed = res.get("chunks_indexed", 0)
            chunks_count += chunks_indexed
            indexed_count += 1
            print(f" Success! Chunks: {chunks_indexed}")
        except Exception as e:
            print(f" Failed: {e}")
            
    print("\n" + "="*50)
    print(f"Bulk Indexing Completed Successfully!")
    print(f"Indexed Documents: {indexed_count}/{len(docs)}")
    print(f"Total FAISS Vector Chunks: {chunks_count}")
    print("="*50)

if __name__ == "__main__":
    main()
