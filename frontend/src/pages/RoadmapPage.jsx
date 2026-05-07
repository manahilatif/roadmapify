// src/pages/RoadmapPage.jsx
import { useState, useCallback } from 'react'
import ChatButton from '../components/ChatButton.jsx'

/* ── Normalise any backend shape → flat node list ────────────────────────────*/
function normalise(data) {
  if (!data) return []

  // nodes[] — current schema
  if (data.nodes && Array.isArray(data.nodes)) {
    return data.nodes.map((n, i) => ({
      ...n,
      id:     String(n.id ?? `n${i}`),
      steps:  n.steps || [],
      status: i === 0 ? 'active' : (n.status || 'locked'),
    }))
  }

  // modules[] schema
  if (data.modules && Array.isArray(data.modules)) {
    return data.modules.map((m, i) => ({
      id:             String(m.id ?? i + 1),
      title:          m.title || `Module ${i + 1}`,
      description:    m.description || '',
      type:           'main',
      emoji:          ['🚀','📐','⚙️','🔗','🎨','🧪','🛠','🔐','📊','🌐'][i % 10],
      duration_label: m.week ? `Week ${m.week}` : `Week ${i + 1}`,
      xp_reward:      (m.estimatedHours || 5) * 20,
      status:         i === 0 ? 'active' : 'locked',
      steps:          m.tasks || [],
      resources:      (m.resources || []).map(r => ({
        label: r.title || r.label || '',
        url:   r.url   || '',
        tip:   r.duration || r.type || '',
      })),
    }))
  }

  // stages[] legacy
  if (data.stages && Array.isArray(data.stages)) {
    return data.stages.map((s, i) => ({
      id:             String(s.id ?? `s${i}`),
      title:          s.title || `Stage ${i + 1}`,
      description:    (s.topics || []).join(', '),
      type:           s.type || 'main',
      emoji:          '📘',
      duration_label: s.week_start ? `Week ${s.week_start}` : `Week ${i + 1}`,
      xp_reward:      100,
      status:         i === 0 ? 'active' : 'locked',
      steps:          [],
      resources:      (s.resources || []).map(r =>
        typeof r === 'string' ? { label: r, url: '', tip: '' } : r
      ),
    }))
  }

  return []
}

/* ── Sine-wave zigzag layout ─────────────────────────────────────────────────*/
function layoutNodes(nodes) {
  const main  = nodes.filter(n => n.type !== 'bonus')
  const bonus = nodes.filter(n => n.type === 'bonus')
  const pos   = {}
  const CX = 185, AMP = 78, RH = 92

  main.forEach((n, i) => {
    pos[n.id] = { x: CX + Math.sin(i * 1.15) * AMP, y: 64 + i * RH }
  })
  bonus.forEach((n, i) => {
    const lastMain = main[main.length - 1]
    const p = lastMain ? pos[lastMain.id] : { x: CX, y: 64 }
    pos[n.id] = { x: p.x + 115 + (i % 2) * 14, y: p.y + (i % 2 === 0 ? -24 : 40) }
  })
  return pos
}

function buildConnectors(nodes, pos) {
  const lines = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1]
    const pa = pos[a.id], pb = pos[b.id]
    if (!pa || !pb) continue
    lines.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, isBonus: b.type === 'bonus' })
  }
  return lines
}

/* ── Single map node ─────────────────────────────────────────────────────────*/
function MapNode({ node, pos, state, isSelected, onClick }) {
  const isBonus  = node.type === 'bonus'
  const isDone   = state === 'done'
  const isActive = state === 'active'
  const isLocked = state === 'locked'
  const r        = isBonus ? 24 : 30

  const fill   = isDone   ? '#3a3a3a'
               : isBonus  ? 'rgba(202,154,4,0.18)'
               : isActive ? '#e52929'
               :             '#2a2a2a'
  const stroke = isDone   ? '#555'
               : isBonus  ? '#ca9a04'
               : isActive ? '#e52929'
               :             '#3a3a3a'

  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      onClick={() => !isLocked && onClick(node)}
      style={{ cursor: isLocked ? 'default' : 'pointer' }}
    >
      {isActive && <>
        <circle r={r + 14} fill="none" stroke="#e52929" strokeWidth={1.5} opacity={0.25}
          style={{ animation: 'rmP1 2s ease-out infinite' }} />
        <circle r={r + 28} fill="none" stroke="#e52929" strokeWidth={1} opacity={0.1}
          style={{ animation: 'rmP2 2s ease-out infinite' }} />
      </>}

      {isSelected && (
        <circle r={r + 6} fill="none"
          stroke={isBonus ? '#ca9a04' : '#e52929'}
          strokeWidth={2} opacity={0.7} />
      )}

      <circle r={r} fill={fill} stroke={stroke}
        strokeWidth={isActive || isSelected ? 2.5 : 1.5} />

      {isActive && (
        <circle r={r} fill="#e52929" opacity={0.15} style={{ filter: 'blur(8px)' }} />
      )}

      <text
        textAnchor="middle" dominantBaseline="middle"
        y={node.duration_label && !isLocked ? -7 : 0}
        fontSize={isLocked ? 14 : isBonus ? 16 : 18}
        style={{ userSelect: 'none' }}
        fill={isDone ? '#888' : isLocked ? '#555' : '#fff'}
      >
        {isDone ? '✓' : isBonus ? '★' : isLocked ? '🔒' : (node.emoji || '●')}
      </text>

      {!isLocked && node.duration_label && (
        <text textAnchor="middle" dominantBaseline="middle" y={10}
          fontSize={8} fill="rgba(255,255,255,0.5)" style={{ userSelect: 'none' }}>
          {node.duration_label}
        </text>
      )}

      <text
        textAnchor="middle" y={r + 16} fontSize={10.5}
        fill={isLocked ? '#444' : isDone ? '#777' : '#f0f0f0'}
        fontWeight={isActive ? 700 : 400}
        style={{ userSelect: 'none' }}
      >
        {(node.title || '').length > 18
          ? (node.title || '').slice(0, 17) + '…'
          : (node.title || '')}
      </text>

      {isBonus && (
        <text textAnchor="middle" y={r + 30}
          fontSize={8.5} fill="#ca9a04" fontWeight={600}
          style={{ userSelect: 'none' }}>
          ★ BONUS PATH
        </text>
      )}

      {!isLocked && (
        <g transform={`translate(${r - 4}, ${-r + 8})`}>
          <rect x={-14} y={-7} width={28} height={14} rx={7}
            fill={isBonus ? '#ca9a04' : '#e52929'} opacity={0.9} />
          <text textAnchor="middle" dominantBaseline="middle"
            fontSize={7.5} fill="#fff" fontWeight={700} style={{ userSelect: 'none' }}>
            +{node.xp_reward || 100}
          </text>
        </g>
      )}
    </g>
  )
}

/* ── Side panel ──────────────────────────────────────────────────────────────*/
function NodePanel({ node, state, onClose, onComplete, onResourceClick }) {
  if (!node) return null
  const isDone   = state === 'done'
  const isActive = state === 'active'
  const isBonus  = node.type === 'bonus'
  const steps     = node.steps || []
  const resources = node.resources || []

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, height: '100%', width: '340px',
      background: '#111', borderLeft: '1px solid rgba(255,255,255,0.07)',
      zIndex: 40,                          // BELOW the top bar (z:50)
      display: 'flex', flexDirection: 'column',
      animation: 'rmSlideIn 0.22s ease',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Spacer so panel content starts below the top info bar */}
      <div style={{ flexShrink: 0, height: 90 }} />

      {/* Header */}
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        background: isBonus ? 'rgba(202,154,4,0.06)' : 'rgba(229,41,41,0.06)',
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px',
          background: isBonus ? 'rgba(202,154,4,0.15)' : 'rgba(229,41,41,0.15)',
          border: `1px solid ${isBonus ? 'rgba(202,154,4,0.3)' : 'rgba(229,41,41,0.3)'}`,
          borderRadius: 100, marginBottom: 10,
        }}>
          <span style={{ fontSize: 11, color: isBonus ? '#ca9a04' : '#e52929', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {isBonus ? '★ Bonus path' : 'Main path'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{node.emoji || '📘'}</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
              {node.title}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4, flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Duration + XP grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          {[
            ['Duration', node.duration_label || '–'],
            ['XP Reward', `⚡ ${node.xp_reward || 100}`],
          ].map(([label, value]) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '9px 12px',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Status */}
        <div style={{ marginTop: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700,
            background: isDone   ? 'rgba(16,185,129,0.15)'
                      : isActive ? 'rgba(229,41,41,0.15)'
                      :             'rgba(255,255,255,0.06)',
            color:      isDone   ? '#10b981'
                      : isActive ? '#e52929'
                      :             'rgba(255,255,255,0.4)',
            border: `1px solid ${isDone   ? 'rgba(16,185,129,0.3)'
                                : isActive ? 'rgba(229,41,41,0.3)'
                                :             'rgba(255,255,255,0.1)'}`,
          }}>
            {isDone ? '✓ Done' : isActive ? '▶ In Progress' : '🔒 Locked'}
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Description */}
        {node.description && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              What to do
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, margin: 0 }}>
              {node.description}
            </p>
          </div>
        )}

        {/* HOW TO DO IT — steps */}
        {steps.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              How to do it
            </div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {steps.map((step, i) => {
                const cleaned = step.replace(/^Step\s*\d+[:.]\s*/i, '')
                return (
                  <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(229,41,41,0.12)',
                      border: '1px solid rgba(229,41,41,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#e52929', fontWeight: 700, marginTop: 1,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.6 }}>
                      {cleaned}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {/* RESOURCES */}
        {resources.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Resources
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resources.map((res, i) => {
                const hasUrl = res.url && res.url.startsWith('https://')
                return (
                  <div
                    key={i}
                    onClick={() => {
                      onResourceClick && onResourceClick(res)
                      if (hasUrl) window.open(res.url, '_blank', 'noopener,noreferrer')
                    }}
                    style={{
                      padding: '11px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      cursor: hasUrl ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (hasUrl) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                        {res.label || res.title || 'Resource'}
                      </span>
                      {hasUrl && <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>↗</span>}
                    </div>
                    {res.tip && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>
                        {res.tip}
                      </div>
                    )}
                    {hasUrl && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 3 }}>
                        {res.url.replace(/^https?:\/\//, '').split('/')[0]}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {isDone && (
          <div style={{
            padding: 14, borderRadius: 10,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
            textAlign: 'center', color: '#10b981', fontWeight: 700, fontSize: 14,
          }}>
            ✓ Completed!
          </div>
        )}
      </div>

      {/* Mark complete */}
      {isActive && !isDone && (
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button
            onClick={() => onComplete(node)}
            style={{
              width: '100%', padding: '13px 0',
              background: isBonus ? '#ca9a04' : '#e52929',
              border: 'none', borderRadius: 10, color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {isBonus ? '⭐ Complete bonus level!' : '✓ Mark as complete'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Confetti ─────────────────────────────────────────────────────────────────*/
function Confetti({ x, y }) {
  const colors = ['#e52929','#f59e0b','#10b981','#3b82f6','#8b5cf6']
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 999 }}>
      {Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * 360
        const dist  = 40 + Math.random() * 60
        return (
          <div key={i} style={{
            position: 'absolute', width: 7, height: 7, borderRadius: 2,
            background: colors[i % colors.length],
            animation: 'rmConfetti 0.9s ease-out forwards',
            animationDelay: `${i * 0.03}s`,
            '--dx': `${Math.cos(angle * Math.PI / 180) * dist}px`,
            '--dy': `${Math.sin(angle * Math.PI / 180) * dist - 50}px`,
          }} />
        )
      })}
    </div>
  )
}

/* ── XP float ─────────────────────────────────────────────────────────────────*/
function XPFloat({ xp, x, y }) {
  return (
    <div style={{
      position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 999,
      fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22,
      color: '#f59e0b', animation: 'rmXpFloat 1.2s ease-out forwards',
      textShadow: '0 2px 8px rgba(0,0,0,0.6)',
    }}>
      +{xp} XP ⚡
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────────*/
export default function RoadmapPage({ data, onBack }) {
  const [nodes,    setNodes]    = useState(() => normalise(data))
  const [selected, setSelected] = useState(null)
  const [earnedXP, setEarnedXP] = useState(0)
  const [streak,   setStreak]   = useState(data?.streak || 8)
  const [confetti, setConfetti] = useState(null)
  const [xpFloat,  setXpFloat]  = useState(null)
  const [activeResource, setActiveResource] = useState(null)

  const totalXP   = data?.total_xp || nodes.reduce((s, n) => s + (n.xp_reward || 100), 0)
  const doneCount = nodes.filter(n => n.status === 'done').length
  const pct       = nodes.length ? Math.round(doneCount / nodes.length * 100) : 0
  const allDone   = doneCount === nodes.length && nodes.length > 0
  const title     = data?.title || data?.goal || 'Your Roadmap'

  const pos   = layoutNodes(nodes)
  const conns = buildConnectors(nodes, pos)

  const maxX = Math.max(...Object.values(pos).map(p => p.x), 0) + 80
  const maxY = Math.max(...Object.values(pos).map(p => p.y), 0) + 80
  const svgW = Math.max(maxX + 60, 420)
  const svgH = allDone ? maxY + 120 : maxY + 40

  function getState(n) {
    if (n.status === 'done')   return 'done'
    if (n.status === 'active') return 'active'
    return 'locked'
  }

  const handleComplete = useCallback((node) => {
    const idx = nodes.findIndex(n => n.id === node.id)
    if (idx < 0) return

    const next = nodes.map((n, i) => i === idx ? { ...n, status: 'done' } : n)
    const ni = next.findIndex((n, i) => i > idx && n.type !== 'bonus' && n.status === 'locked')
    if (ni >= 0) next[ni] = { ...next[ni], status: 'active' }
    if (next.filter(n => n.type !== 'bonus').every(n => n.status === 'done')) {
      const bi = next.findIndex(n => n.type === 'bonus' && n.status === 'locked')
      if (bi >= 0) next[bi] = { ...next[bi], status: 'active' }
    }

    setNodes(next)
    setEarnedXP(p => p + (node.xp_reward || 100))
    setStreak(s => s + 1)
    setSelected(null)

    const cx = window.innerWidth / 2 - (selected ? 170 : 0)
    const cy = window.innerHeight / 3
    setConfetti({ x: cx, y: cy, key: Date.now() })
    setXpFloat({ xp: node.xp_reward || 100, x: cx - 40, y: cy - 60, key: Date.now() })
  }, [nodes, selected])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--bg, #0a0a0a)', color: 'var(--tp, #fff)',
      fontFamily: "'DM Sans', sans-serif", overflow: 'hidden',
    }}>

      <style>{`
        @keyframes rmP1       { 0%,100%{opacity:.25} 50%{opacity:.5}  }
        @keyframes rmP2       { 0%,100%{opacity:.1}  50%{opacity:.25} }
        @keyframes rmSlideIn  { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes rmConfetti { 0%{transform:translate(0,0) rotate(0deg);opacity:1} 100%{transform:translate(var(--dx),var(--dy)) rotate(720deg);opacity:0} }
        @keyframes rmXpFloat  { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-80px);opacity:0} }
        @keyframes pathDraw   { to{stroke-dashoffset:0} }
        ::-webkit-scrollbar       { width: 4px }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px }
      `}</style>

      {/* ── TOP INFO BAR — always on top, never hidden ── */}
      <div style={{
        position: 'relative', zIndex: 50,          // higher than panel (z:40)
        padding: '18px 24px 14px',
        background: 'var(--bg, #0a0a0a)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexShrink: 0,
        // Push right content away from the panel when it's open
        paddingRight: selected ? 'calc(340px + 24px)' : '24px',
        transition: 'padding-right 0.22s ease',
      }}>
        {/* Title + subtitle */}
        <div style={{ minWidth: 0, flex: 1, marginRight: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>
            {doneCount}/{nodes.length} nodes · personalized journey
          </div>
        </div>

        {/* Right side: progress + streak + back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {/* % */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#e52929', fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
              {pct}%
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              {doneCount}/{nodes.length} nodes
            </div>
          </div>

          {/* XP bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 100, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${totalXP > 0 ? Math.round(earnedXP / totalXP * 100) : 0}%`,
                height: '100%', background: '#e52929', borderRadius: 3, transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
              {earnedXP} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>/ {totalXP} XP</span>
            </span>
          </div>

          {/* Streak */}
          <div style={{
            padding: '6px 14px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 100, display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
          }}>
            🔥 {streak} day streak
          </div>

          {/* Back */}
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', padding: '6px 16px', borderRadius: 10,
              cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              whiteSpace: 'nowrap',
            }}
          >
            ← Home
          </button>
        </div>
      </div>

      {/* ── MAP AREA ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Scrollable map — shrinks when panel is open */}
        <div style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          marginRight: selected ? 340 : 0,
          transition: 'margin-right 0.22s ease',
        }}>
          <svg
            width={svgW} height={svgH}
            style={{ display: 'block', margin: '0 auto' }}
          >
            {/* Connectors */}
            {conns.map((c, i) => {
              const mx = (c.x1 + c.x2) / 2, my = (c.y1 + c.y2) / 2
              return (
                <path key={i}
                  d={`M${c.x1},${c.y1} Q${mx + (c.isBonus ? 30 : 0)},${my} ${c.x2},${c.y2}`}
                  fill="none"
                  stroke={c.isBonus ? 'rgba(202,154,4,0.2)' : 'rgba(229,41,41,0.14)'}
                  strokeWidth={c.isBonus ? 1.5 : 2}
                  strokeDasharray={c.isBonus ? '5 4' : '7 5'}
                  style={{ animation: `pathDraw 1s ease forwards ${i * 0.05}s`, strokeDashoffset: 900 }}
                />
              )
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const p = pos[n.id]
              if (!p) return null
              return (
                <MapNode key={n.id} node={n} pos={p}
                  state={getState(n)}
                  isSelected={selected?.id === n.id}
                  onClick={setSelected} />
              )
            })}

            {/* All-done trophy */}
            {allDone && (
              <g transform={`translate(${svgW / 2},${maxY + 40})`}>
                <text textAnchor="middle" fontSize={38}>🏆</text>
                <text textAnchor="middle" y={46} fontSize={14} fill="#fbbf24" fontWeight={700}>Roadmap Complete!</text>
                <text textAnchor="middle" y={64} fontSize={11} fill="rgba(255,255,255,0.38)">
                  {earnedXP} XP earned · {streak} day streak
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Panel — fixed right, below the top bar */}
        {selected && (
          <NodePanel
            node={selected}
            state={getState(selected)}
            onClose={() => setSelected(null)}
            onComplete={handleComplete}
            onResourceClick={setActiveResource}
          />
        )}
      </div>

      {/* ── LEGEND ── */}
      <div style={{
        position: 'fixed', bottom: 20, left: 20,
        background: 'rgba(17,17,17,0.92)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12,
        padding: '9px 14px', display: 'flex', gap: 14,
        fontSize: 11, color: 'rgba(255,255,255,0.45)', zIndex: 30,
      }}>
        {[['#e52929','Active'],['#555','Done'],['#2a2a2a','Locked'],['#ca9a04','Bonus']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}
          </div>
        ))}
      </div>

      {/* Effects */}
      {confetti && <Confetti key={confetti.key} x={confetti.x} y={confetti.y} />}
      {xpFloat  && <XPFloat  key={xpFloat.key}  xp={xpFloat.xp} x={xpFloat.x} y={xpFloat.y} />}

      {/* Chatbot */}
      <ChatButton
        roadmap={data}
        currentModule={selected}
        currentResource={activeResource}
      />
    </div>
  )
}