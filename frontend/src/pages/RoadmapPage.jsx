import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar.jsx'

// ── XP bar component ───────────────────────────────────────────────────────────
function XPBar({ earned, total }) {
  const pct = Math.round((earned / total) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
        {earned} / {total} XP
      </span>
      <div style={{ width: 120, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${pct}%`, background: 'var(--accent)',
          transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: '0 0 8px var(--accent)',
        }} />
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{pct}%</span>
    </div>
  )
}

// ── Mini confetti burst ────────────────────────────────────────────────────────
function ConfettiBurst({ x, y, onDone }) {
  const colors = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i, color: colors[i % colors.length],
    angle: (i / 18) * 360,
    distance: 40 + Math.random() * 60,
  }))
  useEffect(() => { const t = setTimeout(onDone, 1000); return () => clearTimeout(t) }, [onDone])
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 1000 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', width: 6, height: 6, borderRadius: '50%',
          background: p.color, left: 0, top: 0,
          animation: `confetti-fly 0.9s ease-out forwards`,
          '--angle': `${p.angle}deg`, '--dist': `${p.distance}px`,
        }} />
      ))}
    </div>
  )
}

// ── XP float label ─────────────────────────────────────────────────────────────
function XPFloat({ xp, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 1200); return () => clearTimeout(t) }, [onDone])
  return (
    <div style={{
      position: 'fixed', bottom: 100, right: 32, zIndex: 999,
      fontSize: 22, fontWeight: 700, color: '#fbbf24',
      fontFamily: 'var(--font-display)',
      animation: 'xp-float 1.2s ease-out forwards',
    }}>
      +{xp} XP ⚡
    </div>
  )
}

// ── Node component ─────────────────────────────────────────────────────────────
function RoadmapNode({ node, index, total, isLeft, onClick }) {
  const isActive  = node.status === 'active'
  const isDone    = node.status === 'done'
  const isLocked  = node.status === 'locked'
  const isBonus   = node.type === 'bonus'

  const nodeSize = isActive ? 86 : 72

  const bgColor = isDone
    ? 'rgba(16,185,129,0.2)'
    : isActive
    ? 'rgba(220,38,38,0.25)'
    : isBonus
    ? 'rgba(251,191,36,0.1)'
    : 'rgba(255,255,255,0.05)'

  const borderColor = isDone
    ? '#10b981'
    : isActive
    ? 'var(--accent)'
    : isBonus
    ? '#fbbf24'
    : 'rgba(255,255,255,0.12)'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      cursor: isLocked && !isBonus ? 'not-allowed' : 'pointer',
      opacity: isLocked && !isBonus ? 0.45 : 1,
      transition: 'opacity 0.3s',
    }} onClick={() => !isLocked && onClick(node)}>

      {/* Duration label above */}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {node.duration_label}
      </div>

      {/* Node circle */}
      <div style={{ position: 'relative' }}>
        {/* Pulse rings for active node */}
        {isActive && (
          <>
            <div style={{
              position: 'absolute', inset: -12, borderRadius: '50%',
              border: '2px solid rgba(220,38,38,0.4)',
              animation: 'pulse-ring 2s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: -20, borderRadius: '50%',
              border: '1.5px solid rgba(220,38,38,0.2)',
              animation: 'pulse-ring 2s ease-out infinite 0.4s',
            }} />
          </>
        )}

        <div style={{
          width: nodeSize, height: nodeSize, borderRadius: '50%',
          background: bgColor, border: `2px solid ${borderColor}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: isActive ? `0 0 24px rgba(220,38,38,0.4)` : isDone ? `0 0 16px rgba(16,185,129,0.3)` : 'none',
          transition: 'all 0.3s',
          position: 'relative', zIndex: 2,
        }}>
          {isDone ? (
            <span style={{ fontSize: 24 }}>✓</span>
          ) : isLocked && !isBonus ? (
            <span style={{ fontSize: 20 }}>🔒</span>
          ) : (
            <span style={{ fontSize: isActive ? 28 : 22 }}>{node.emoji || '⭐'}</span>
          )}
        </div>

        {/* XP badge */}
        {(isActive || isDone) && (
          <div style={{
            position: 'absolute', bottom: -2, right: -4,
            background: isDone ? '#10b981' : 'var(--accent)',
            borderRadius: 10, padding: '2px 6px',
            fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
          }}>
            {isDone ? '✓' : `+${node.xp_reward}`}
          </div>
        )}
      </div>

      {/* Node title */}
      <div style={{
        fontSize: 13, fontWeight: isActive ? 700 : 500,
        color: isActive ? 'var(--text)' : isDone ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)',
        textAlign: 'center', maxWidth: 110, lineHeight: 1.3,
      }}>
        {node.title}
      </div>
    </div>
  )
}

// ── Side panel ─────────────────────────────────────────────────────────────────
function NodePanel({ node, onClose, onComplete }) {
  if (!node) return null
  const isDone   = node.status === 'done'
  const isBonus  = node.type === 'bonus'

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
        animation: 'fade-in 0.2s ease',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 'min(440px, 100vw)',
        background: '#111', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 201, overflowY: 'auto', padding: '32px 28px',
        animation: 'slide-in-right 0.3s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          alignSelf: 'flex-end', background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', padding: 0,
        }}>✕</button>

        {/* Emoji + title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>{node.emoji || (isBonus ? '⭐' : '🎯')}</div>
          {isBonus && (
            <div style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 20, marginBottom: 8,
              background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)',
              fontSize: 11, color: '#fbbf24', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>✦ Bonus Level</div>
          )}
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            {node.title}
          </h2>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{node.duration_label}</div>
        </div>

        {/* XP badge */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 0', borderRadius: 10,
          background: isDone ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)',
          border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : 'rgba(220,38,38,0.3)'}`,
        }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: 17 }}>{node.xp_reward} XP</span>
          {isDone && <span style={{ color: '#10b981', fontSize: 13 }}>— earned!</span>}
        </div>

        {/* Description */}
        <div>
          <h3 style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            What to do
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, fontSize: 15 }}>
            {node.description}
          </p>
        </div>

        {/* Resources */}
        {node.resources?.length > 0 && (
          <div>
            <h3 style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Resources
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {node.resources.map((r, i) => (
                <div key={i} style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: r.tip ? 4 : 0 }}>{r.label}</div>
                  {r.tip && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{r.tip}</div>}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: 12, color: 'var(--accent)', marginTop: 4, display: 'block',
                    }}>
                      Open →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Complete button */}
        {!isDone && (
          <button onClick={() => onComplete(node)} style={{
            marginTop: 'auto', padding: '16px', borderRadius: 12,
            background: isBonus ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--accent)',
            border: 'none', color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', transition: 'opacity 0.2s',
          }}>
            {isBonus ? '⭐ Complete bonus level!' : '✓ Mark as complete'}
          </button>
        )}
        {isDone && (
          <div style={{
            marginTop: 'auto', padding: '16px', borderRadius: 12,
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            textAlign: 'center', color: '#10b981', fontWeight: 700, fontSize: 15,
          }}>
            ✓ Completed!
          </div>
        )}
      </div>
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function RoadmapPage({ data, onBack }) {
  const [nodes, setNodes]           = useState(() =>
    (data?.nodes || []).map((n, i) => ({
      ...n,
      status: i === 0 ? 'active' : (n.status || 'locked'),
    }))
  )
  const [selectedNode, setSelectedNode] = useState(null)
  const [streak, setStreak]             = useState(7)
  const [confetti, setConfetti]         = useState(null)
  const [xpFloat, setXpFloat]           = useState(null)
  const [earnedXP, setEarnedXP]         = useState(0)
  const totalXP = data?.total_xp || nodes.reduce((s, n) => s + (n.xp_reward || 100), 0)

  // Connector path between two nodes (zigzag layout)
  const nodePositions = useRef([])

  const handleComplete = (node) => {
    const idx = nodes.findIndex(n => n.id === node.id)
    if (idx === -1) return

    const updated = [...nodes]
    updated[idx] = { ...updated[idx], status: 'done' }

    // Unlock next main node
    const nextMain = updated.slice(idx + 1).find(n => n.type === 'main' && n.status === 'locked')
    if (nextMain) nextMain.status = 'active'

    // Unlock bonus if all main nodes done
    const allMainDone = updated.filter(n => n.type === 'main').every(n => n.status === 'done')
    if (allMainDone) {
      const bonusNode = updated.find(n => n.type === 'bonus')
      if (bonusNode && bonusNode.status === 'locked') bonusNode.status = 'active'
    }

    setNodes(updated)
    setEarnedXP(p => p + (node.xp_reward || 100))
    setStreak(s => s + 1)
    setSelectedNode(null)

    // Confetti + XP float
    setConfetti({ x: window.innerWidth / 2, y: window.innerHeight / 2, key: Date.now() })
    setXpFloat({ xp: node.xp_reward || 100, key: Date.now() })
  }

  const mainNodes  = nodes.filter(n => n.type === 'main')
  const bonusNode  = nodes.find(n => n.type === 'bonus')
  const doneCount  = nodes.filter(n => n.status === 'done').length
  const totalCount = nodes.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
      {/* Animations */}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes confetti-fly {
          0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(
                   calc(cos(var(--angle)) * var(--dist)),
                   calc(sin(var(--angle)) * var(--dist))
                 ) rotate(540deg); opacity: 0; }
        }
        @keyframes xp-float {
          0%   { transform: translateY(0);   opacity: 1; }
          100% { transform: translateY(-60px); opacity: 0; }
        }
        @keyframes fade-in {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); } to { transform: translateX(0); }
        }
        @keyframes node-unlock {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      <Navbar onBack={onBack} showBack />

      {/* Confetti */}
      {confetti && (
        <ConfettiBurst key={confetti.key} x={confetti.x} y={confetti.y} onDone={() => setConfetti(null)} />
      )}
      {xpFloat && (
        <XPFloat key={xpFloat.key} xp={xpFloat.xp} onDone={() => setXpFloat(null)} />
      )}

      {/* Header strip */}
      <div style={{
        position: 'fixed', top: 60, left: 0, right: 0, zIndex: 50,
        padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h1 style={{ fontSize: 'clamp(13px,2vw,15px)', fontWeight: 700, margin: 0 }}>{data?.title || 'Your Roadmap'}</h1>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            {doneCount}/{totalCount} nodes · personalized journey
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <XPBar earned={earnedXP} total={totalXP} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
          }}>
            <span style={{ fontSize: 16 }}>🔥</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fbbf24' }}>{streak} day streak</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'fixed', bottom: 20, left: 16, zIndex: 50,
        display: 'flex', gap: 14, padding: '8px 14px', borderRadius: 20,
        background: 'rgba(10,10,10,0.85)', border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)',
      }}>
        {[
          { color: 'var(--accent)', label: 'Active' },
          { color: '#10b981', label: 'Done' },
          { color: 'rgba(255,255,255,0.2)', label: 'Locked' },
          { color: '#fbbf24', label: 'Bonus' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Map canvas */}
      <div style={{ paddingTop: 130, paddingBottom: 80 }}>
        <div style={{ maxWidth: 380, margin: '0 auto', position: 'relative', padding: '0 24px' }}>

          {/* SVG connector lines */}
          <svg style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible',
          }}>
            {mainNodes.map((node, i) => {
              if (i === 0) return null
              // Zigzag: even indices left, odd right — connect between them
              const fromX = i % 2 === 0 ? '70%' : '30%'
              const toX   = i % 2 === 0 ? '30%' : '70%'
              const yUnit = 140
              const fromY = (i - 1) * yUnit + 86
              const toY   = i * yUnit + 20

              const isDoneFrom = mainNodes[i - 1]?.status === 'done'
              return (
                <path key={node.id}
                  d={`M ${fromX} ${fromY} C ${fromX} ${(fromY + toY) / 2}, ${toX} ${(fromY + toY) / 2}, ${toX} ${toY}`}
                  fill="none"
                  stroke={isDoneFrom ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}
                  strokeWidth={isDoneFrom ? 2 : 1.5}
                  strokeDasharray={isDoneFrom ? 'none' : '5 5'}
                />
              )
            })}
          </svg>

          {/* Nodes in zigzag */}
          {mainNodes.map((node, i) => {
            const isLeft = i % 2 === 0
            return (
              <div key={node.id} style={{
                display: 'flex',
                justifyContent: isLeft ? 'flex-start' : 'flex-end',
                marginBottom: 54,
                paddingLeft: isLeft ? 0 : '40%',
                paddingRight: isLeft ? '40%' : 0,
              }}>
                <RoadmapNode
                  node={node} index={i} total={mainNodes.length}
                  isLeft={isLeft}
                  onClick={setSelectedNode}
                />
              </div>
            )
          })}

          {/* Bonus node — always right-branched */}
          {bonusNode && (
            <div style={{ position: 'relative', marginTop: 16 }}>
              {/* Dashed connector to bonus */}
              <div style={{
                position: 'absolute', top: -30, right: '18%',
                fontSize: 11, color: '#fbbf24', letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                ✦ bonus path
              </div>
              <svg style={{
                position: 'absolute', top: -24, right: 0, left: 0,
                height: 24, pointerEvents: 'none',
              }}>
                <path d="M 50% 0 Q 80% 12 75% 24"
                  fill="none" stroke="rgba(251,191,36,0.4)"
                  strokeWidth="1.5" strokeDasharray="4 4" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <RoadmapNode
                  node={bonusNode} index={0} total={1}
                  isLeft={false}
                  onClick={setSelectedNode}
                />
              </div>
            </div>
          )}

          {/* All-done celebration */}
          {doneCount > 0 && doneCount === totalCount && (
            <div style={{
              marginTop: 40, padding: '24px', borderRadius: 16, textAlign: 'center',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              animation: 'node-unlock 0.5s ease',
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                Roadmap complete!
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                You earned {totalXP} XP and a {streak}-day streak.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      <NodePanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onComplete={handleComplete}
      />
    </div>
  )
}