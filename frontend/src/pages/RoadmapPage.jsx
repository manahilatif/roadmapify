import { useState, useCallback } from 'react'
import Navbar from '../components/Navbar.jsx'

/* ── Normalise both old (stages) and new (nodes) backend shapes ──────────────*/
function normalise(data) {
  if (data.nodes && Array.isArray(data.nodes)) {
    return data.nodes.map((n, i) => ({
      id:             n.id || `n${i}`,
      label:          n.title || n.label || `Step ${i + 1}`,
      type:           n.type || 'main',
      week:           n.duration_label || n.week || `Week ${i + 1}`,
      xp_reward:      n.xp_reward || 100,
      description:    n.description || '',
      emoji:          n.emoji || '',
      resources:      n.resources || [],
      topics:         n.topics || [],
      dependencies:   i === 0 ? [] : [data.nodes[i - 1]?.id || `n${i - 1}`],
      status:         n.status || (i === 0 ? 'active' : 'locked'),
    }))
  }
  if (data.stages && Array.isArray(data.stages)) {
    return data.stages.map((s, i) => ({
      id:           s.id || `s${i}`,
      label:        s.title || s.name || `Stage ${i + 1}`,
      type:         s.type || 'main',
      week:         s.week_start || s.week || i + 1,
      xp_reward:    100,
      description:  '',
      emoji:        '',
      resources:    s.resources || [],
      topics:       s.topics || [],
      dependencies: i === 0 ? [] : [data.stages[i - 1]?.id || `s${i - 1}`],
      status:       i === 0 ? 'active' : 'locked',
    }))
  }
  return []
}

function layoutNodes(nodes) {
  const main  = nodes.filter(n => n.type !== 'bonus')
  const bonus = nodes.filter(n => n.type === 'bonus')
  const pos   = {}
  const CX = 185, AMP = 78, RH = 92
  main.forEach((n, i)  => { pos[n.id] = { x: CX + Math.sin(i * 1.15) * AMP, y: 64 + i * RH } })
  bonus.forEach((n, i) => {
    const pid = n.dependencies?.[0]
    const p   = pid && pos[pid] ? pos[pid] : { x: CX, y: 64 }
    pos[n.id] = { x: p.x + 115 + (i % 2) * 14, y: p.y + (i % 2 === 0 ? -24 : 40) }
  })
  return pos
}

/* ── Confetti ─────────────────────────────────────────────────────────────────*/
function Confetti({ x, y, onDone }) {
  const colors = ['#e52929', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']
  const pieces = Array.from({ length: 16 }, (_, i) => ({
    id: i, color: colors[i % colors.length],
    angle: (i / 16) * 360, dist: 40 + Math.random() * 50,
  }))
  useState(() => { const t = setTimeout(onDone, 1000); return () => clearTimeout(t) })
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 999 }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', width: 6, height: 6, borderRadius: '50%',
          background: p.color, animation: 'confetti-pop 0.9s ease-out forwards',
          '--deg': `${p.angle}deg`, '--d': `${p.dist}px`,
        }} />
      ))}
    </div>
  )
}

function XPFloat({ xp, onDone }) {
  useState(() => { const t = setTimeout(onDone, 1200); return () => clearTimeout(t) })
  return (
    <div style={{
      position: 'fixed', bottom: 100, right: 340, zIndex: 999,
      fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.4rem',
      color: '#f59e0b', animation: 'xp-up 1.2s ease-out forwards', pointerEvents: 'none',
    }}>
      +{xp} XP ⚡
    </div>
  )
}

/* ── Map node ─────────────────────────────────────────────────────────────────*/
function MapNode({ node, pos, state, isSelected, onClick, idx }) {
  const isBonus  = node.type === 'bonus'
  const isDone   = state === 'done'
  const isActive = state === 'active'
  const isLocked = state === 'locked'
  const r = isBonus ? 24 : 30

  return (
    <g style={{ cursor: isLocked ? 'not-allowed' : 'pointer', animation: `fadeUp 0.4s var(--ease) both ${0.04 + idx * 0.055}s`, opacity: 0 }}
      onClick={() => !isLocked && onClick(node)}>
      {isActive && <>
        <circle cx={pos.x} cy={pos.y} r={r + 13} fill="none" stroke="rgba(229,41,41,0.32)" strokeWidth="1.5" style={{ animation: 'pulse-ring 2s ease-out infinite' }} />
        <circle cx={pos.x} cy={pos.y} r={r + 22} fill="none" stroke="rgba(229,41,41,0.12)" strokeWidth="1"   style={{ animation: 'pulse-ring 2s ease-out 0.5s infinite' }} />
      </>}
      {isSelected && !isActive && (
        <circle cx={pos.x} cy={pos.y} r={r + 9} fill="none" stroke="rgba(229,41,41,0.4)" strokeWidth="2" strokeDasharray="4 3" />
      )}
      <circle cx={pos.x} cy={pos.y} r={r}
        fill={isDone ? '#1c1c1c' : isActive ? '#e52929' : isBonus ? '#1e1800' : '#181818'}
        stroke={isSelected ? '#e52929' : isDone ? '#3a3a3a' : isActive ? '#e52929' : isBonus ? '#ca9a04' : '#2a2a2a'}
        strokeWidth={isActive || isSelected ? 2.5 : 1.5}
        style={isActive ? { filter: 'drop-shadow(0 0 13px rgba(229,41,41,0.55))' } : {}}
      />
      <text x={pos.x} y={pos.y + 6} textAnchor="middle" style={{ fontSize: isActive ? '11px' : '15px', fontFamily: "'Syne',sans-serif", fontWeight: 800, fill: isDone ? '#444' : isActive ? '#fff' : isBonus ? '#ca9a04' : '#333', userSelect: 'none', pointerEvents: 'none' }}>
        {isDone ? '✓' : isActive ? (node.emoji || 'NOW') : isBonus ? '★' : '🔒'}
      </text>
      <text x={pos.x} y={pos.y + r + 17} textAnchor="middle" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '11.5px', fill: isLocked ? '#3a3a3a' : isBonus ? '#ca9a04' : isActive ? '#f87171' : '#5a5a5a', fontWeight: isActive ? 600 : 400, userSelect: 'none', pointerEvents: 'none' }}>
        {node.label}
      </text>
      <text x={pos.x} y={pos.y - r - 7} textAnchor="middle" style={{ fontFamily: "'Syne',sans-serif", fontSize: '9px', fill: 'rgba(255,255,255,0.11)', userSelect: 'none', pointerEvents: 'none', letterSpacing: '0.06em' }}>
        {typeof node.week === 'number' ? `WK ${node.week}` : node.week}
      </text>
    </g>
  )
}

/* ── Sidebar ──────────────────────────────────────────────────────────────────*/
function NodePanel({ node, state, onClose, onComplete }) {
  const isBonus = node.type === 'bonus'
  const isDone  = state === 'done'
  const icons   = ['📹', '📄', '🎓']

  // Handle both string[] (old) and {label,url,tip}[] (new) resource formats
  const resources = (Array.isArray(node.resources) ? node.resources : []).map(r =>
    typeof r === 'string' ? { label: r, url: '', tip: '' } : r
  )

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '310px', background: 'var(--s0)', borderLeft: '1px solid var(--border)', padding: '24px 20px', overflowY: 'auto', zIndex: 50, animation: 'fadeUp 0.22s var(--ease)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ paddingTop: '68px' }}>
        <div className={`badge ${isBonus ? 'badge-gold' : 'badge-red'}`} style={{ marginBottom: '10px' }}>
          {isBonus ? '★ Bonus quest' : 'Main path'}
        </div>
        <h3 style={{ fontSize: '1.3rem', letterSpacing: '-0.02em' }}>
          {node.emoji ? `${node.emoji} ` : ''}{node.label}
        </h3>
      </div>

      <button onClick={onClose} style={{ position: 'absolute', top: '76px', right: '16px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ts)', fontSize: '16px' }}>×</button>

      {/* Meta */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: '3px' }}>Duration</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem' }}>{node.week}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: '3px' }}>XP reward</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem', color: '#f59e0b' }}>⚡ {node.xp_reward}</div>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: '5px' }}>Status</div>
          <span className={`badge ${state === 'active' ? 'badge-red' : 'badge-gray'}`}>
            {isDone ? '✓ Completed' : state === 'active' ? '▶ In progress' : '🔒 Locked'}
          </span>
        </div>
      </div>

      {/* Description (new format) */}
      {node.description && (
        <div>
          <div style={{ fontSize: '0.65rem', fontFamily: "'Syne',sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tm)', marginBottom: '9px' }}>What to do</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--ts)', lineHeight: 1.6, margin: 0 }}>{node.description}</p>
        </div>
      )}

      {/* Topics (old format) */}
      {node.topics && node.topics.length > 0 && (
        <div>
          <div style={{ fontSize: '0.65rem', fontFamily: "'Syne',sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tm)', marginBottom: '9px' }}>Topics covered</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {node.topics.map((t, i) => (
              <span key={i} style={{ background: 'var(--s2)', border: '1px solid var(--border-md)', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', color: 'var(--ts)' }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Resources — links work, tips shown, icons preserved */}
      {resources.length > 0 && (
        <div>
          <div style={{ fontSize: '0.65rem', fontFamily: "'Syne',sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tm)', marginBottom: '9px' }}>Curated resources</div>
          {resources.map((r, i) => {
            const hasLink = r.url && r.url.trim() !== ''
            const card = (
              <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: '9px', marginBottom: '6px', transition: 'border-color 0.15s', cursor: hasLink ? 'pointer' : 'default' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(229,41,41,0.28)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ width: '26px', height: '26px', background: 'rgba(229,41,41,0.09)', border: '1px solid rgba(229,41,41,0.15)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>{icons[i % 3]}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--tp)' }}>{r.label}</div>
                  {r.tip && <div style={{ fontSize: '0.75rem', color: 'var(--tm)', marginTop: '2px' }}>{r.tip}</div>}
                  {hasLink && <div style={{ fontSize: '0.72rem', color: 'var(--r4)', marginTop: '3px' }}>Open resource →</div>}
                </div>
              </div>
            )
            return hasLink
              ? <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>{card}</a>
              : <div key={i}>{card}</div>
          })}
        </div>
      )}

      {/* CTA */}
      {state !== 'locked' && (
        <div style={{ marginTop: 'auto' }}>
          {isDone
            ? <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '13px' }}>✓ Completed</button>
            : <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px' }} onClick={() => onComplete(node)}>
                {isBonus ? '⭐ Complete bonus level' : '✓ Mark as complete'}
              </button>
          }
        </div>
      )}
    </div>
  )
}

/* ── Main ─────────────────────────────────────────────────────────────────────*/
export default function RoadmapPage({ data, onBack }) {
  const [selected,  setSelected]  = useState(null)
  const [completed, setCompleted] = useState(new Set())
  const [earnedXP,  setEarnedXP]  = useState(0)
  const [confetti,  setConfetti]  = useState(null)
  const [xpFloat,   setXpFloat]   = useState(null)
  const [streak,    setStreak]    = useState(7)

  const nodes = normalise(data)
  const pos   = layoutNodes(nodes)

  const getState = useCallback((node) => {
    if (completed.has(node.id)) return 'done'
    const deps    = node.dependencies || []
    const allDone = deps.every(d => completed.has(d))
    if (!allDone) return 'locked'
    if (node.type === 'bonus') {
      const allMainDone = nodes.filter(n => n.type !== 'bonus').every(n => completed.has(n.id))
      return allMainDone ? 'active' : 'locked'
    }
    const firstUnlocked = nodes.filter(n => n.type !== 'bonus')
      .find(n => !completed.has(n.id) && (n.dependencies || []).every(d => completed.has(d)))
    return node.id === firstUnlocked?.id ? 'active' : 'locked'
  }, [completed, nodes])

  const getStateFixed = useCallback((node) => {
    if (completed.size === 0) {
      const firstMain = nodes.find(n => n.type !== 'bonus')
      return node.id === firstMain?.id ? 'active' : 'locked'
    }
    return getState(node)
  }, [completed, nodes, getState])

  const handleComplete = (node) => {
    const next = new Set(completed)
    next.add(node.id)
    setCompleted(next)
    setEarnedXP(p => p + (node.xp_reward || 100))
    setStreak(s => s + 1)
    setSelected(null)
    setConfetti({ x: window.innerWidth / 2, y: window.innerHeight / 2, key: Date.now() })
    setXpFloat({ xp: node.xp_reward || 100, key: Date.now() })
  }

  const allPos    = Object.values(pos)
  const svgW      = Math.max(...allPos.map(p => p.x), 0) + 100
  const svgH      = Math.max(...allPos.map(p => p.y), 0) + 120
  const mainNodes = nodes.filter(n => n.type !== 'bonus')
  const doneCount = mainNodes.filter(n => completed.has(n.id)).length
  const progress  = mainNodes.length > 0 ? Math.round((doneCount / mainNodes.length) * 100) : 0
  const totalXP   = data.total_xp || nodes.reduce((s, n) => s + (n.xp_reward || 100), 0)

  const connections = []
  nodes.forEach(n => {
    ;(n.dependencies || []).forEach(did => {
      const f = pos[did], t = pos[n.id]
      if (f && t) connections.push({ key: `${did}-${n.id}`, x1: f.x, y1: f.y, x2: t.x, y2: t.y, isBonus: n.type === 'bonus' })
    })
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
      <style>{`
        @keyframes pulse-ring  { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(1.5);opacity:0} }
        @keyframes confetti-pop{ 0%{transform:translate(0,0) rotate(0deg);opacity:1} 100%{transform:translate(calc(cos(var(--deg))*var(--d)),calc(sin(var(--deg))*var(--d))) rotate(540deg);opacity:0} }
        @keyframes xp-up       { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-60px);opacity:0} }
      `}</style>

      <Navbar onBack={onBack} showBack />
      {confetti && <Confetti key={confetti.key} x={confetti.x} y={confetti.y} onDone={() => setConfetti(null)} />}
      {xpFloat  && <XPFloat  key={xpFloat.key}  xp={xpFloat.xp}               onDone={() => setXpFloat(null)}  />}

      {/* Info bar */}
      <div style={{ position: 'fixed', top: '60px', left: 0, right: selected ? '310px' : 0, zIndex: 40, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: '20px', transition: 'right 0.3s var(--ease)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.9375rem' }}>{data.title || 'Your Roadmap'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--ts)' }}>{doneCount}/{nodes.length} nodes · personalized journey</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.3rem', color: 'var(--r4)', letterSpacing: '-0.03em' }}>{progress}%</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--tm)' }}>{doneCount}/{mainNodes.length} nodes</div>
          </div>
          <div style={{ width: '88px' }}>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1rem', color: '#f59e0b' }}>
              {earnedXP}<span style={{ fontSize: '0.65rem', fontWeight: 400, marginLeft: '3px' }}>/ {totalXP} XP</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'rgba(229,41,41,0.08)', border: '1px solid rgba(229,41,41,0.16)', borderRadius: '100px' }}>
          <span style={{ fontSize: '15px' }}>🔥</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.8rem', color: 'var(--r3)' }}>{streak} day streak</span>
        </div>
      </div>

      {/* Map canvas */}
      <div style={{ paddingTop: '120px', paddingBottom: '60px', paddingRight: selected ? '310px' : 0, display: 'flex', justifyContent: 'center', minHeight: '100vh', transition: 'padding-right 0.3s var(--ease)', position: 'relative' }}>
        <div style={{ position: 'fixed', top: '50%', left: selected ? 'calc(50% - 155px)' : '50%', transform: 'translate(-50%,-50%)', width: '500px', height: '500px', background: 'radial-gradient(circle,rgba(229,41,41,0.045) 0%,transparent 65%)', pointerEvents: 'none', transition: 'left 0.3s var(--ease)' }} />
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: 'visible' }}>
          {nodes.some(n => n.type === 'bonus') && (
            <text x={svgW - 10} y="46" textAnchor="end" style={{ fontFamily: "'Syne',sans-serif", fontSize: '9px', fill: 'rgba(202,154,4,0.38)', letterSpacing: '0.1em', userSelect: 'none' }}>★ BONUS PATH</text>
          )}
          {connections.map((c, i) => (
            <line key={c.key} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
              stroke={c.isBonus ? 'rgba(202,154,4,0.2)' : 'rgba(229,41,41,0.14)'}
              strokeWidth={c.isBonus ? 1.5 : 2} strokeDasharray={c.isBonus ? '5 4' : '7 5'}
              style={{ animation: `pathDraw 1s ease forwards ${i * 0.05}s`, strokeDashoffset: 900 }}
            />
          ))}
          {nodes.map((n, i) => {
            const p = pos[n.id]
            if (!p) return null
            return <MapNode key={n.id} node={n} pos={p} state={getStateFixed(n)} isSelected={selected?.id === n.id} onClick={setSelected} idx={i} />
          })}
        </svg>
      </div>

      {selected && <NodePanel node={selected} state={getStateFixed(selected)} onClose={() => setSelected(null)} onComplete={handleComplete} />}

      {/* Legend */}
      <div style={{ position: 'fixed', bottom: '20px', left: '20px', background: 'rgba(17,17,17,0.92)', backdropFilter: 'blur(10px)', border: '1px solid var(--border)', borderRadius: '12px', padding: '9px 14px', display: 'flex', gap: '14px', fontSize: '0.7rem', color: 'var(--ts)', zIndex: 30 }}>
        {[['#e52929', 'Active'], ['#3a3a3a', 'Done'], ['#2a2a2a', 'Locked'], ['#ca9a04', 'Bonus']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, border: '1px solid rgba(255,255,255,0.1)' }} />{l}
          </div>
        ))}
      </div>
    </div>
  )
}