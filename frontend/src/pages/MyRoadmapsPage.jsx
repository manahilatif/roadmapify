// src/pages/MyRoadmapsPage.jsx
import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import { useAuth } from '../context/AuthContext'
import { listUserRoadmaps } from '../services/roadmapsFirestore'

function formatUpdated(at) {
  if (!at) return ''
  const d = typeof at.toDate === 'function' ? at.toDate() : at.seconds ? new Date(at.seconds * 1000) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
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

export default function MyRoadmapsPage({ onBack, onOpenRoadmap, refreshKey = 0 }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        if (!cancelled) setItems(list)
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
        if (!cancelled) setItems(list)
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
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((row) => {
              const rd = row.roadmapData || {}
              const title = rd.title || rd.goal || row.topic || 'Untitled roadmap'
              const { pct, done, total } = statsFromRoadmap(rd)
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onOpenRoadmap(row.id, rd)}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 14, padding: '18px 20px', cursor: 'pointer',
                      color: '#fff', transition: 'background 0.15s, border-color 0.15s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                      e.currentTarget.style.borderColor = 'rgba(229,41,41,0.35)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6, lineHeight: 1.35 }}>
                          {title}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                          {total > 0 && (
                            <span>{done}/{total} complete · </span>
                          )}
                          Updated {formatUpdated(row.updatedAt) || 'recently'}
                        </div>
                      </div>
                      <div style={{
                        flexShrink: 0, padding: '6px 12px', borderRadius: 100,
                        background: 'rgba(229,41,41,0.15)', border: '1px solid rgba(229,41,41,0.3)',
                        fontSize: '0.85rem', fontWeight: 800, fontFamily: "'Syne', sans-serif",
                        color: '#e52929',
                      }}>
                        {pct}%
                      </div>
                    </div>
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
