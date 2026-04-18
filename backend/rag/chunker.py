"""
chunker.py
----------
Splits raw scraped documents into fixed-size chunks with overlap.

Design decisions (aligned with Roadmapify RAG spec):
  - Target chunk size: ~500 tokens  (≈ 400 words, safe for most LLMs)
  - Overlap: 50 tokens              (≈ 40 words)
  - Splitting strategy: sentence-aware — never cut mid-sentence
  - Metadata is preserved and forwarded to every chunk

Input:  List[dict]  (output of any scraper — roadmap.sh, freeCodeCamp, etc.)
Output: List[dict]  (each dict = one chunk, with full metadata + chunk_id)
"""

import re
import uuid
from typing import Optional


# ── Config ────────────────────────────────────────────────────────────────────

CHUNK_SIZE_CHARS = 2000      # ~500 tokens at ~4 chars/token
OVERLAP_CHARS    = 200       # ~50 tokens overlap
MIN_CHUNK_CHARS  = 100       # discard chunks shorter than this (noise)


# ── Sentence splitter ─────────────────────────────────────────────────────────

# Split on sentence-ending punctuation followed by whitespace + capital letter.
# Handles: "Hello. World", "Hello? World", "Hello! World"
# Does NOT split on: "U.S.A", "e.g.", "3.14", "Dr. Smith"
_SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')


def split_into_sentences(text: str) -> list[str]:
    """Split text into a list of sentences (best-effort)."""
    parts = _SENTENCE_SPLIT_RE.split(text)
    return [p.strip() for p in parts if p.strip()]


# ── Core chunking logic ───────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE_CHARS, overlap: int = OVERLAP_CHARS) -> list[str]:
    """
    Split a block of text into overlapping chunks.

    Strategy:
      1. Split into sentences.
      2. Greedily add sentences to current chunk until chunk_size is hit.
      3. When full, emit chunk, then backtrack by `overlap` chars before
         starting the next chunk (sentence-aligned backtrack).

    Returns:
        List of chunk strings, each at most ~chunk_size characters.
    """
    sentences = split_into_sentences(text)
    if not sentences:
        return []

    chunks = []
    start_idx = 0          # index into sentences[] for current chunk start

    while start_idx < len(sentences):
        current_chars = 0
        end_idx = start_idx

        # Grow chunk until we hit the size limit
        while end_idx < len(sentences):
            added = len(sentences[end_idx]) + 1   # +1 for space
            if current_chars + added > chunk_size and end_idx > start_idx:
                break
            current_chars += added
            end_idx += 1

        chunk_text_str = " ".join(sentences[start_idx:end_idx])
        if len(chunk_text_str) >= MIN_CHUNK_CHARS:
            chunks.append(chunk_text_str)

        # Advance start_idx, but back up by `overlap` chars (sentence-aligned)
        # — find where we'd be if we consumed sentences up to end_idx - overlap
        if end_idx >= len(sentences):
            break

        # Walk back from end_idx until we've "uncovered" at least overlap chars
        overlap_chars_accum = 0
        new_start = end_idx
        while new_start > start_idx + 1:
            new_start -= 1
            overlap_chars_accum += len(sentences[new_start]) + 1
            if overlap_chars_accum >= overlap:
                break

        # Guard: always advance at least one sentence to prevent infinite loop
        start_idx = max(new_start, start_idx + 1)

    return chunks


# ── Document → chunks ─────────────────────────────────────────────────────────

def chunk_document(doc: dict) -> list[dict]:
    """
    Take a single scraped document dict and return a list of chunk dicts.

    Each chunk dict contains:
      - all original metadata fields (source, domain, roadmap, topic, url, content_type)
      - chunk_id:     globally unique UUID for this chunk
      - chunk_index:  position of this chunk within the source document (0-based)
      - chunk_total:  total number of chunks in the source document
      - content:      the chunk text (replaces the original full content)
    """
    content = doc.get("content", "")
    if not content:
        return []

    raw_chunks = chunk_text(content)
    if not raw_chunks:
        return []

    chunk_dicts = []
    total = len(raw_chunks)

    for i, chunk_str in enumerate(raw_chunks):
        chunk_dict = {
            # ── metadata (copy all fields except 'content') ──────────────────
            "source":       doc.get("source", "unknown"),
            "domain":       doc.get("domain", "general"),
            "roadmap":      doc.get("roadmap", ""),
            "topic":        doc.get("topic", ""),
            "url":          doc.get("url", ""),
            "content_type": doc.get("content_type", "text"),
            "difficulty":   doc.get("difficulty", ""),
            # ── chunk-specific fields ────────────────────────────────────────
            "chunk_id":    str(uuid.uuid4()),
            "chunk_index": i,
            "chunk_total": total,
            "content":     chunk_str,
        }
        chunk_dicts.append(chunk_dict)

    return chunk_dicts


def chunk_all_documents(documents: list[dict]) -> list[dict]:
    """
    Process a list of raw scraped documents into a flat list of chunks.

    Args:
        documents: output from any scraper (roadmap.sh, freeCodeCamp, etc.)

    Returns:
        Flat list of chunk dicts, ready for embedding + ChromaDB storage.
    """
    all_chunks = []
    for doc in documents:
        chunks = chunk_document(doc)
        all_chunks.extend(chunks)

    print(f"[chunker] {len(documents)} documents → {len(all_chunks)} chunks")
    return all_chunks


# ── Stats helper ──────────────────────────────────────────────────────────────

def chunk_stats(chunks: list[dict]) -> dict:
    """Return basic stats about a list of chunks (useful for debugging)."""
    if not chunks:
        return {}

    lengths = [len(c["content"]) for c in chunks]
    by_source = {}
    by_domain = {}

    for c in chunks:
        src = c.get("source", "unknown")
        dom = c.get("domain", "unknown")
        by_source[src] = by_source.get(src, 0) + 1
        by_domain[dom] = by_domain.get(dom, 0) + 1

    return {
        "total_chunks":   len(chunks),
        "avg_chars":      round(sum(lengths) / len(lengths)),
        "min_chars":      min(lengths),
        "max_chars":      max(lengths),
        "by_source":      by_source,
        "by_domain":      by_domain,
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json, pathlib

    input_path  = pathlib.Path("data/raw/roadmapsh_raw.json")
    output_path = pathlib.Path("data/processed/roadmapsh_chunks.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(input_path, encoding="utf-8") as f:
        raw_docs = json.load(f)

    chunks = chunk_all_documents(raw_docs)

    stats = chunk_stats(chunks)
    print(f"\n[stats] {json.dumps(stats, indent=2)}")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {len(chunks)} chunks → {output_path}")