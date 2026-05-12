"""
rag_pipeline.py
---------------
Retrieval layer for Roadmapify.
Given a user query, fetches the most relevant chunks from ChromaDB.

Uses the same embedding function as embedder.py (ChromaDB built-in SentenceTransformer)
so query embeddings are in the same vector space as stored chunk embeddings.
"""

import sys
import pathlib

# Allow imports from project root when run directly
sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from backend.rag.embedder import get_collection

# Load collection once at module level (reused across requests)
_collection = get_collection()


def retrieve_context(query: str, n_results: int = 8) -> list[dict]:
    """
    Query ChromaDB for the most relevant chunks to the given user query.

    Args:
        query:     the user's learning goal / question
        n_results: number of top chunks to retrieve

    Returns:
        List of dicts, each with 'content' plus all metadata fields
        (source, domain, topic, url, etc.) from the stored chunk.
    """
    results = _collection.query(
        query_texts=[query],
        n_results=n_results,
        include=["documents", "metadatas"],
    )

    docs   = results["documents"][0]
    metas  = results["metadatas"][0]

    if not docs:
        return []

    return [{"content": doc, **meta} for doc, meta in zip(docs, metas)]