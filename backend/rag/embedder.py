"""
ChromaDB collection accessor using SentenceTransformer embeddings.

Uses the same embedding model as typical Roadmapify ingestion so queries align
with stored vectors. Collection is created on first use if missing (empty KB).
"""

from __future__ import annotations

import os
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

# Default matches backend/.env.example
_DEFAULT_DB_PATH = "./chroma_db"
_DEFAULT_COLLECTION = "roadmapify_kb"
_DEFAULT_MODEL = "all-MiniLM-L6-v2"


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_collection():
    """
    Return the ChromaDB collection used for roadmap retrieval.

    Resolves CHROMA_DB_PATH relative to the project root when not absolute.
    """
    raw_path = os.environ.get("CHROMA_DB_PATH", _DEFAULT_DB_PATH)
    db_path = Path(raw_path)
    if not db_path.is_absolute():
        db_path = _project_root() / db_path
    db_path.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(path=str(db_path))
    model_name = os.environ.get("CHROMA_EMBED_MODEL", _DEFAULT_MODEL)
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=model_name)
    name = os.environ.get("CHROMA_COLLECTION", _DEFAULT_COLLECTION)
    return client.get_or_create_collection(name=name, embedding_function=ef)
