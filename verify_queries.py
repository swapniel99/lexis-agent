"""verify_queries.py

Verification script that runs the 5 specific landmark Indian corporate & real estate
RAG queries directly using agent7.py's four-role cognitive loop, validating
vector retrieval accuracy and synthesis.
"""

import asyncio
import sys
from pathlib import Path

# Add current dir to path to import agent7
sys.path.insert(0, str(Path(__file__).parent))
import agent7

QUERIES = [
    {
        "id": 1,
        "type": "Direct Corporate",
        "q": "What did the Supreme Court of India rule in Swiss Ribbons regarding the constitutional validity of IBC 2016?"
    },
    {
        "id": 2,
        "type": "Semantic Real Estate",
        "q": "Are flat buyers considered financial creditors or operational creditors in real estate insolvencies under Indian law?"
    },
    {
        "id": 3,
        "type": "Multi-step Comparison",
        "q": "Compare how secured and unsecured creditors are treated under the Essar Steel judgment of the Supreme Court."
    },
    {
        "id": 4,
        "type": "Direct Real Estate",
        "q": "What were the primary reasons for the demolition of the Supertech Twin Towers in Noida?"
    },
    {
        "id": 5,
        "type": "Semantic Corporate",
        "q": "What rules govern insider trading according to SEBI regulations in India?"
    }
]

async def run_all_verifications():
    print("="*80)
    print("LEXIS-RAG: BEGINNING SYSTEM VERIFICATION RUN")
    print("="*80)
    
    for item in QUERIES:
        print(f"\n[VERIFY QUERY {item['id']} - {item['type']}]")
        print(f"Query: \"{item['q']}\"")
        print("-" * 50)
        
        try:
            # Run the agent7 cognitive loop
            ans = await agent7.run(item['q'])
            print(f"RESULT:\n{ans}")
        except Exception as e:
            print(f"ERROR executing query: {e}")
            
        print("="*80)

if __name__ == "__main__":
    asyncio.run(run_all_verifications())
