// src/pages/MyRoadmapsPage.jsx
import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import { useAuth } from '../context/AuthContext'
import { deleteUserRoadmap, listUserRoadmaps } from '../services/roadmapsFirestore'

function formatUpdated(at) {
  if (!at) return ''
  const d = typeof at.toDate === 'function' ? at.toDate() : at.seconds ? new Date(at.seconds * 1000) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Firestore row: either `{ roadmapData }` (current) or legacy flat `{ nodes, title }` */
function roadmapPayloadFromListRow(row) {
  if (!row) return null
  const nested = row.roadmapData
  if (nested && Array.isArray(nested.nodes) && nested.nodes.length > 0) return nested
  if (Array.isArray(row.nodes) && row.nodes.length > 0) {
    return {
      title: row.title || row.topic || 'Roadmap',
      goal: row.goal || '',
      topic: row.topic || '',
      nodes: row.nodes,
    }
  }
  return null
}

function statsFromRoadmap(rd) {
  const nodes = rd?.nodes
  if (!Array.isArray(nodes) || nodes.length === 0) return { pct: 0, done: 0, total: 0 }
  const main = nodes.filter((n) => n.type !== 'bonus')
  const denom = main.length || nodes.length
  const list = main.length ? main : nodes
  const done = list.filter((n) => n.status === 'done').length
  const pct = denom ? Math.round((done / denom) * 100) : 0
  return { pct, done, total: denom }
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M10 11v6M14 11v6M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m3 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function MyRoadmapsPage({ onBack, onOpenRoadmap, refreshKey = 0 }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!user?.uid) {
        setLoading(false)
        return
      }
      setError('')
      setLoading(true)
      try {
        const list = await listUserRoadmaps(user.uid)
        const usable = list.filter((row) => roadmapPayloadFromListRow(row))
        if (!cancelled) setItems(usable)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('Could not load your roadmaps. Check Firestore rules and your connection.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.uid, refreshKey])

  /* Coming back from another tab/window after completing nodes — refresh list */
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    const load = async () => {
      try {
        const list = await listUserRoadmaps(user.uid)
        const usable = list.filter((row) => roadmapPayloadFromListRow(row))
        if (!cancelled) setItems(usable)
      } catch {
        /* ignore transient refresh errors */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user?.uid])

  const handleDelete = async (e, roadmapId) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user?.uid || deletingId) return
    if (!window.confirm('Delete this roadmap? This cannot be undone.')) return
    setError('')
    setDeletingId(roadmapId)
    try {
      await deleteUserRoadmap(user.uid, roadmapId)
      setItems((prev) => prev.filter((r) => r.id !== roadmapId))
    } catch (err) {
      console.error(err)
      setError('Could not delete roadmap. Check Firestore rules and try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', paddingTop: 80 }}>
        <Navbar onBack={onBack} showBack />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.75rem', marginBottom: 12 }}>Sign in required</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 28 }}>
            Sign in from the home page to save and view your roadmaps.
          </p>
          <button type="button" className="btn btn-primary" onClick={onBack}>← Back home</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', paddingTop: 72 }}>
      <Navbar onBack={onBack} showBack />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>
          My roadmaps
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 28, fontSize: '0.95rem' }}>
          Continue where you left off — progress syncs automatically while you use a roadmap.
        </p>

        {loading && (
          <div style={{ color: 'rgba(255,255,255,0.45)', padding: '40px 0', textAlign: 'center' }}>
            Loading…
          </div>
        )}

        {error && (
          <div style={{
            padding: '14px 18px', borderRadius: 12,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5', marginBottom: 20, fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div style={{
            padding: '36px 28px', borderRadius: 16,
            border: '1px dashed rgba(255,255,255,0.15)', textAlign: 'center',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗺️</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>No saved roadmaps yet</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', marginBottom: 22 }}>
              Generate a roadmap while signed in — it will appear here automatically.
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={onBack}>
              Create a roadmap
            </button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {items.map((row) => {
              const rd = roadmapPayloadFromListRow(row)
              const title = rd?.title || rd?.goal || row.topic || 'Roadmap'
              const { pct, done, total } = statsFromRoadmap(rd)
              const busy = deletingId === row.id
              return (
                <li
                  key={row.id}
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 10,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
                  }}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => !busy && onOpenRoadmap(row.id, rd)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      padding: '18px 16px 18px 20px',
                      cursor: busy ? 'wait' : 'pointer',
                      color: '#fff',
                      fontFamily: 'inherit',
                      opacity: busy ? 0.65 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '1.08rem',
                            marginBottom: 8,
                            lineHeight: 1.35,
                            color: '#fafafa',
                          }}
                        >
                          {title}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.58)', lineHeight: 1.45 }}>
                          {total > 0 && (
                            <span>{done}/{total} milestones · </span>
                          )}
                          Updated {formatUpdated(row.updatedAt) || 'recently'}
                        </div>
                      </div>
                      <div
                        style={{
                          flexShrink: 0,
                          minWidth: 56,
                          textAlign: 'center',
                          padding: '8px 14px',
                          borderRadius: 10,
                          background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
                          border: '1px solid #fca5a5',
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          fontFamily: "'DM Sans', system-ui, sans-serif",
                          color: '#ffffff',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {pct}%
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Delete roadmap: ${title}`}
                    title="Delete roadmap"
                    onClick={(e) => handleDelete(e, row.id)}
                    style={{
                      flexShrink: 0,
                      width: 52,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.04)',
                      border: 'none',
                      borderLeft: '1px solid rgba(255,255,255,0.1)',
                      color: busy ? 'rgba(255,255,255,0.25)' : 'rgba(248,113,113,0.95)',
                      cursor: busy ? 'wait' : 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!busy) {
                        e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
                        e.currentTarget.style.color = '#fecaca'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.color = busy ? 'rgba(255,255,255,0.25)' : 'rgba(248,113,113,0.95)'
                    }}
                  >
                    {busy ? (
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>…</span>
                    ) : (
                      <TrashIcon />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
