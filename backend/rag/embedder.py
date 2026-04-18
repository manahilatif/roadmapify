"""
embedder.py
-----------
Embeds text chunks and stores them in ChromaDB.

Design decisions (aligned with Roadmapify RAG spec):
  - Embedding model: sentence-transformers/all-MiniLM-L6-v2
    (lightweight, fast, good quality — no API key needed)
    NOTE: swap to text-embedding-3-small (OpenAI) once API keys are set up
  - ChromaDB: runs locally (persistent client), no external server needed
  - Collection name: "roadmapify_kb" — one collection for the full knowledge base
  - Metadata stored per chunk enables domain/topic/source filtering at retrieval
  - Batch size: 64 — safe for memory on most machines

Paths and names can be overridden via environment (see backend/.env.example):
  CHROMA_DB_PATH, CHROMA_COLLECTION, CHROMA_EMBED_MODEL

Usage:
    python embedder.py                    # embed all chunks from data/processed/
    from backend.rag.embedder import get_collection   # use in rag_pipeline / agents
"""

from __future__ import annotations

import json
import os
import pathlib
import time
from typing import Optional

import chromadb
from chromadb.utils import embedding_functions

# ── Config ────────────────────────────────────────────────────────────────────

BATCH_SIZE = 64  # chunks per upsert call

_DEFAULT_DB = "./chroma_db"
_DEFAULT_COLLECTION = "roadmapify_kb"
_DEFAULT_EMBED = "all-MiniLM-L6-v2"


def _project_root() -> pathlib.Path:
    """Repo root (parent of ``backend/``)."""
    return pathlib.Path(__file__).resolve().parents[2]


def _resolved_chroma_path() -> str:
    """
    Persistent Chroma path from ``CHROMA_DB_PATH`` (default ./chroma_db).
    Relative paths are resolved against the project root.
    """
    raw = os.environ.get("CHROMA_DB_PATH", _DEFAULT_DB)
    p = pathlib.Path(raw)
    if not p.is_absolute():
        p = _project_root() / p
    p.mkdir(parents=True, exist_ok=True)
    return str(p)


def _collection_name() -> str:
    return os.environ.get("CHROMA_COLLECTION", _DEFAULT_COLLECTION)


def _embed_model() -> str:
    return os.environ.get("CHROMA_EMBED_MODEL", _DEFAULT_EMBED)


# Backwards-compatible names (used by ingestion CLI and tests)
CHROMA_DB_PATH = _resolved_chroma_path()
COLLECTION_NAME = _collection_name()
EMBED_MODEL = _embed_model()


# ── ChromaDB client + collection factory ──────────────────────────────────────


def get_chroma_client() -> chromadb.PersistentClient:
    """
    Return a persistent ChromaDB client backed by local disk.
    Creates the DB directory if it doesn't exist.
    """
    return chromadb.PersistentClient(path=_resolved_chroma_path())


def get_embedding_function(embed_model: Optional[str] = None):
    """
    Return the best available embedding function for this environment.

    Priority order:
      1. SentenceTransformerEmbeddingFunction — production choice (all-MiniLM-L6-v2)
         Requires: pip install sentence-transformers
         Requires: internet access to download model on first run
         (~90MB download, cached to ~/.cache/huggingface/ afterwards)

      2. DefaultEmbeddingFunction (ChromaDB built-in) — fallback
         Uses all-MiniLM-L6-v2 via onnx (bundled with chromadb[default]).
         Same model, no separate download needed if chromadb[default] is installed.
         Install: pip install "chromadb[default]"

      3. Bare DefaultEmbeddingFunction — last resort / CI/sandbox
         Works without any model download; lower quality but functional.

    NOTE: On your development machine, run:
        pip install sentence-transformers
    The first `get_collection()` call will download the model (~90MB).
    All subsequent calls will use the cached version.
    """
    model = embed_model if embed_model is not None else _embed_model()
    # Try sentence-transformers first (production)
    try:
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=model
        )
        print(f"[embedder] Using SentenceTransformer: {model}")
        return ef
    except Exception as e:
        print(
            f"[embedder] SentenceTransformer unavailable ({e}), "
            "falling back to ChromaDB default EF"
        )

    # Fallback: ChromaDB's default embedding function
    try:
        ef = embedding_functions.DefaultEmbeddingFunction()
        print("[embedder] Using ChromaDB DefaultEmbeddingFunction")
        return ef
    except Exception as e:
        print(f"[embedder] DefaultEmbeddingFunction also failed: {e}")
        print("[embedder] WARNING: Using None — embeddings will not work correctly!")
        return None


def get_collection(
    client: Optional[chromadb.PersistentClient] = None,
    collection_name: Optional[str] = None,
    embed_model: Optional[str] = None,
) -> chromadb.Collection:
    """
    Get (or create) the ChromaDB collection with the sentence-transformer
    embedding function attached.

    This is the main entry point used by retriever.py and the agents.

    Args:
        client:          existing PersistentClient, or None to create one
        collection_name: name of the ChromaDB collection
        embed_model:     sentence-transformers model name

    Returns:
        A chromadb.Collection ready for add/query operations.
    """
    if client is None:
        client = get_chroma_client()

    name = collection_name if collection_name is not None else _collection_name()
    ef = get_embedding_function(embed_model if embed_model is not None else _embed_model())

    kwargs = dict(
        name=name,
        metadata={
            "hnsw:space": "cosine",  # cosine similarity for semantic search
            "description": "Roadmapify knowledge base — multi-domain learning content",
        },
    )
    if ef is not None:
        kwargs["embedding_function"] = ef

    collection = client.get_or_create_collection(**kwargs)
    return collection


# ── Store chunks ──────────────────────────────────────────────────────────────


def _sanitize_metadata(meta: dict) -> dict:
    """
    ChromaDB metadata values must be str, int, float, or bool.
    Convert None → "" and drop any unsupported types.
    """
    clean = {}
    for k, v in meta.items():
        if isinstance(v, (str, int, float, bool)):
            clean[k] = v
        elif v is None:
            clean[k] = ""
        else:
            clean[k] = str(v)
    return clean


def store_chunks(
    chunks: list[dict],
    collection: Optional[chromadb.Collection] = None,
    batch_size: int = BATCH_SIZE,
) -> chromadb.Collection:
    """
    Embed and store a list of chunk dicts into ChromaDB.

    Each chunk dict must have:
      - chunk_id (str)   → used as ChromaDB document ID
      - content  (str)   → the text that gets embedded
      - all other fields → stored as metadata

    Uses upsert so re-running is idempotent (existing IDs are updated,
    not duplicated).

    Args:
        chunks:     list of chunk dicts (output of chunker.py)
        collection: existing collection, or None to create/open one
        batch_size: how many chunks to upsert per call

    Returns:
        The ChromaDB collection (for chaining or inspection).
    """
    if not chunks:
        print("[embedder] No chunks to store.")
        return collection or get_collection()

    if collection is None:
        collection = get_collection()

    # Metadata fields to exclude from ChromaDB metadata (already stored in content)
    CONTENT_FIELD = "content"
    ID_FIELD = "chunk_id"

    total = len(chunks)
    batches = (total + batch_size - 1) // batch_size  # ceiling division

    print(
        f"[embedder] Storing {total} chunks in {batches} batches "
        f"(batch_size={batch_size}) ..."
    )

    stored = 0
    for batch_num in range(batches):
        start = batch_num * batch_size
        end = min(start + batch_size, total)
        batch = chunks[start:end]

        ids = [c[ID_FIELD] for c in batch]
        documents = [c[CONTENT_FIELD] for c in batch]
        metadatas = [
            _sanitize_metadata({k: v for k, v in c.items() if k not in (ID_FIELD, CONTENT_FIELD)})
            for c in batch
        ]

        collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )

        stored += len(batch)
        pct = round(stored / total * 100)
        print(f"  batch {batch_num + 1}/{batches} — {stored}/{total} ({pct}%)")

    print(
        f"\n[embedder] Done. Collection '{collection.name}' "
        f"now has {collection.count()} documents."
    )
    return collection


# ── Quick sanity check ────────────────────────────────────────────────────────


def verify_collection(collection: chromadb.Collection, n_results: int = 3) -> None:
    """
    Run a test query against the collection and print results.
    Call this after storing chunks to confirm everything worked.
    """
    test_query = "How do I get started with web development?"
    print(f"\n[verify] Test query: '{test_query}'")

    results = collection.query(
        query_texts=[test_query],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    docs = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    for i, (doc, meta, dist) in enumerate(zip(docs, metadatas, distances)):
        print(f"\n  Result {i + 1}:")
        print(f"    Source:   {meta.get('source')} / {meta.get('domain')}")
        print(f"    Topic:    {meta.get('topic')}")
        print(f"    Distance: {round(dist, 4)}")
        print(f"    Excerpt:  {doc[:120]}...")


# ── Collection info ───────────────────────────────────────────────────────────


def collection_info(collection: chromadb.Collection) -> dict:
    """Return a summary dict of what's stored in the collection."""
    count = collection.count()

    # Sample a few docs to show domain distribution
    sample = collection.get(limit=min(count, 500), include=["metadatas"])
    domain_counts = {}
    source_counts = {}
    for meta in sample["metadatas"]:
        d = meta.get("domain", "unknown")
        s = meta.get("source", "unknown")
        domain_counts[d] = domain_counts.get(d, 0) + 1
        source_counts[s] = source_counts.get(s, 0) + 1

    return {
        "collection": collection.name,
        "total_docs": count,
        "by_domain": dict(sorted(domain_counts.items(), key=lambda x: -x[1])),
        "by_source": dict(sorted(source_counts.items(), key=lambda x: -x[1])),
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    processed_dir = pathlib.Path("data/processed")
    chunk_files = sorted(processed_dir.glob("*.json"))

    if not chunk_files:
        print("[error] No chunk files found in data/processed/. Run chunker.py first.")
        exit(1)

    # Load all chunk files
    all_chunks = []
    for path in chunk_files:
        with open(path, encoding="utf-8") as f:
            chunks = json.load(f)
        print(f"[load] {path.name}: {len(chunks)} chunks")
        all_chunks.extend(chunks)

    print(f"\n[total] {len(all_chunks)} chunks to embed\n")

    # Embed + store
    collection = store_chunks(all_chunks)

    # Print info
    info = collection_info(collection)
    print(f"\n[info] {json.dumps(info, indent=2)}")

    # Verify with a test query
    if collection.count() > 0:
        verify_collection(collection)
