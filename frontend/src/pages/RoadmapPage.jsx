// src/pages/RoadmapPage.jsx
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import ChatButton from '../components/ChatButton.jsx'
import { useAuth } from '../context/AuthContext'
import { updateUserRoadmap } from '../services/roadmapsFirestore'

/* ── Normalise any backend shape → flat node list ────────────────────────────*/
function normalise(data) {
  if (!data) return []

  if (data.nodes && Array.isArray(data.nodes)) {
    const raw = data.nodes.map((n, i) => ({
      ...n,
      id:     String(n.id ?? `n${i}`),
      steps:  n.steps || [],
      status: i === 0 ? 'active' : (n.status || 'locked'),
    }))

    /* Safety net: if the LLM returned fewer than 3 main nodes but the first node
       has steps that look like task names (short, no numbers), explode them into
       individual nodes so the user has a proper game-like progression. */
    const mainRaw = raw.filter(n => n.type !== 'bonus')
    const bonus   = raw.filter(n => n.type === 'bonus')
    const genericTitles = ['getting started', 'foundation', 'introduction', 'basics', 'overview', 'setup']
    const isGenericSingle = mainRaw.length === 1 && genericTitles.some(t => mainRaw[0]?.title?.toLowerCase().includes(t))
    if ((mainRaw.length < 4 || isGenericSingle) && mainRaw[0]?.steps?.length >= 2) {
      const emojis = ['🚀','📖','✏️','🎧','🗣️','📝','⚙️','🔗','🧪','🏁']
      const exploded = []
      mainRaw.forEach(parent => {
        parent.steps.forEach((step, si) => {
          const title = step.replace(/^Step\s*\d+[:.]\s*/i, '').slice(0, 40)
          exploded.push({
            id:             `${parent.id}_s${si}`,
            title,
            description:    `Complete this task: ${title}`,
            type:           'main',
            emoji:          emojis[exploded.length % emojis.length],
            duration_label: `Week ${exploded.length + 1}`,
            xp_reward:      Math.max(50, Math.round((parent.xp_reward || 100) / parent.steps.length)),
            status:         exploded.length === 0 ? 'active' : 'locked',
            steps:          [],
            resources:      si === 0 ? (parent.resources || []) : [],
          })
        })
      })
      return [...exploded, ...bonus]
    }

    return raw
  }

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
  const CX = 185, AMP = 78, RH = 110

  main.forEach((n, i) => {
    pos[n.id] = { x: CX + Math.sin(i * 1.15) * AMP, y: 30 + i * RH }
  })
  bonus.forEach((n, i) => {
    const lastMain = main[main.length - 1]
    const p = lastMain ? pos[lastMain.id] : { x: CX, y: 30 }
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
    lines.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, isBonus: b.type === 'bonus', isDone: a.status === 'done' })
  }
  return lines
}

/* ── Single map node ─────────────────────────────────────────────────────────*/
function MapNode({ node, pos, state, isSelected, onClick }) {
  const isBonus  = node.type === 'bonus'
  const isDone   = state === 'done'
  const isActive = state === 'active'
  const isLocked = state === 'locked'
  const r        = isBonus ? 24 : isActive ? 40 : isDone ? 24 : 28

  const fill   = isDone   ? '#3a3a3a'
               : isBonus  ? (isLocked ? 'rgba(202,154,4,0.06)' : 'rgba(202,154,4,0.18)')
               : isActive ? '#e52929'
               :             'rgba(255,255,255,0.03)'

  const stroke = isDone   ? '#555'
               : isBonus  ? (isLocked ? 'rgba(202,154,4,0.3)' : '#ca9a04')
               : isActive ? '#e52929'
               :             'rgba(255,255,255,0.2)'

  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      onClick={() => onClick(node)}
      style={{ cursor: 'pointer' }}
    >
      {isActive && <>
        <circle r={r + 14} fill="none" stroke="#e52929" strokeWidth={1.5} opacity={0.25}
          style={{ animation: 'rmP1 2s ease-out infinite' }} />
        <circle r={r + 28} fill="none" stroke="#e52929" strokeWidth={1} opacity={0.1}
          style={{ animation: 'rmP2 2s ease-out infinite' }} />
        <text textAnchor="middle" y={-r - 10}
          fontSize={9} fill="#e52929" fontWeight={800}
          letterSpacing="0.18em" style={{ userSelect: 'none' }}>
          NOW
        </text>
      </>}

      {isSelected && (
        <circle r={r + 6} fill="none"
          stroke={isBonus ? '#ca9a04' : '#e52929'}
          strokeWidth={2} opacity={0.7} />
      )}

      <circle r={r} fill={fill} stroke={stroke}
        strokeWidth={isActive || isSelected ? 2.5 : isLocked ? 1.5 : 1.5}
        strokeDasharray={isLocked ? '5 3' : 'none'} />

      {isActive && (
        <circle r={r} fill="#e52929" opacity={0.15} style={{ filter: 'blur(8px)' }} />
      )}

      <text
        textAnchor="middle" dominantBaseline="middle"
        y={node.duration_label && !isLocked ? -7 : 0}
        fontSize={isLocked ? 14 : isBonus ? 16 : 18}
        style={{ userSelect: 'none' }}
        fill={isDone ? '#888' : isLocked ? '#666' : '#fff'}
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
        textAnchor="middle" y={r + 16} fontSize={isActive ? 12 : 10.5}
        fill={isLocked ? '#777' : isDone ? '#777' : isActive ? '#e52929' : '#f0f0f0'}
        fontWeight={isActive ? 700 : 400}
        style={{ userSelect: 'none' }}
      >
        {(node.title || '').length > 18
          ? (node.title || '').slice(0, 17) + '…'
          : (node.title || '')}
      </text>

      {isBonus && !isLocked && (
        <text textAnchor="middle" y={r + 30}
          fontSize={8.5} fill="#ca9a04" fontWeight={600}
          style={{ userSelect: 'none' }}>
          ★ BONUS PATH
        </text>
      )}

      {/* XP badge — reward for unlocked nodes */}
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

      {/* XP cost badge — bonus locked nodes show unlock cost */}
      {isBonus && isLocked && (
        <g transform={`translate(${r - 4}, ${-r + 8})`}>
          <rect x={-22} y={-7} width={44} height={14} rx={7}
            fill="rgba(202,154,4,0.25)" opacity={0.9} />
          <text textAnchor="middle" dominantBaseline="middle"
            fontSize={7} fill="#ca9a04" fontWeight={700} style={{ userSelect: 'none' }}>
            🔓 {node.xp_reward || 250} XP
          </text>
        </g>
      )}
    </g>
  )
}

/* ── Side panel ──────────────────────────────────────────────────────────────*/
function NodePanel({ node, state, onClose, onComplete, onResourceClick, earnedXP, onUnlock }) {
  if (!node) return null
  const isDone   = state === 'done'
  const isActive = state === 'active'
  const isBonus  = node.type === 'bonus'
  const isLocked = state === 'locked'
  const steps     = node.steps || []
  const resources = node.resources || []
  const unlockCost = node.xp_reward || 250
  const canAffordUnlock = earnedXP >= unlockCost

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, height: '100%', width: '340px',
      background: '#111', borderLeft: '1px solid rgba(255,255,255,0.07)',
      zIndex: 40,
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
            [isBonus && isLocked ? 'Unlock Cost' : 'XP Reward',
             isBonus && isLocked ? `⚡ ${unlockCost} XP` : `⚡ ${node.xp_reward || 100}`],
          ].map(([label, value]) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '9px 12px',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isBonus && isLocked ? '#ca9a04' : '#fff' }}>{value}</div>
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
            {isDone ? '✓ Done' : isActive ? '▶ In Progress' : isBonus ? '🔒 Locked — needs XP' : '🔒 Locked'}
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* SECTION 1: What to do (description) */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            What to do
          </div>
          {node.description ? (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, margin: 0 }}>
              {node.description}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
              Overview for this stage will appear here.
            </p>
          )}
        </div>

        {/* SECTION 2: How to do it (steps) */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            How to do it
          </div>
          {steps.length > 0 ? (
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
          ) : (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
              Detailed steps for this node will appear here after generation.
            </p>
          )}
        </div>

        {/* SECTION 3: Resources */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Resources
          </div>
          {resources.length > 0 ? (
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
          ) : (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
              No resources listed for this node yet.
            </p>
          )}
        </div>

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

      {/* Footer actions */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {/* Mark complete — active main node */}
        {isActive && !isDone && !isBonus && (
          <button
            onClick={() => onComplete(node)}
            style={{
              width: '100%', padding: '13px 0',
              background: '#e52929',
              border: 'none', borderRadius: 10, color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ✓ Mark as complete
          </button>
        )}

        {/* Mark complete — active bonus node */}
        {isActive && !isDone && isBonus && (
          <button
            onClick={() => onComplete(node)}
            style={{
              width: '100%', padding: '13px 0',
              background: '#ca9a04',
              border: 'none', borderRadius: 10, color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⭐ Complete bonus level!
          </button>
        )}

        {/* XP Unlock — locked bonus node */}
        {isBonus && isLocked && (
          <div>
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 8,
            }}>
              You have {earnedXP} XP — need {unlockCost} XP to unlock
            </div>
            <button
              onClick={() => canAffordUnlock && onUnlock(node)}
              disabled={!canAffordUnlock}
              style={{
                width: '100%', padding: '13px 0',
                background: canAffordUnlock ? '#ca9a04' : 'rgba(202,154,4,0.2)',
                border: `1px solid ${canAffordUnlock ? '#ca9a04' : 'rgba(202,154,4,0.3)'}`,
                borderRadius: 10, color: canAffordUnlock ? '#fff' : 'rgba(255,255,255,0.3)',
                fontSize: 14, fontWeight: 700,
                cursor: canAffordUnlock ? 'pointer' : 'not-allowed',
              }}
            >
              {canAffordUnlock ? `🔓 Unlock for ${unlockCost} XP` : `🔒 Need ${unlockCost - earnedXP} more XP`}
            </button>
          </div>
        )}

        {/* Locked main node — hint */}
        {isLocked && !isBonus && (
          <div style={{
            padding: '11px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13,
          }}>
            🔒 Complete the previous node to unlock this
          </div>
        )}
      </div>
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
function buildSnapshot(data, nodes, earnedXP, streak) {
  return {
    ...data,
    nodes,
    earnedXP,
    streak,
    topic: data?.topic,
  }
}

export default function RoadmapPage({ data, onBack, savedRoadmapId = null, onProgressChange }) {
  const { user } = useAuth()
  const [nodes,    setNodes]    = useState(() => normalise(data))
  const [selected, setSelected] = useState(null)
  const [earnedXP, setEarnedXP] = useState(data?.earnedXP ?? 0)
  const [streak,   setStreak]   = useState(data?.streak ?? 8)
  const [confetti, setConfetti] = useState(null)
  const [xpFloat,  setXpFloat]  = useState(null)
  const [activeResource, setActiveResource] = useState(null)

  /* Avoid effect dependency on `data` (parent updates would retrigger saves / loops). */
  const dataRef = useRef(data)
  dataRef.current = data

  const roadmapForChat = useMemo(() => ({ ...data, nodes }), [data, nodes])

  /* Keep App’s roadmapData in sync — pehli dafa generate ke baad bhi complete levels yahi object reflect karein */
  useEffect(() => {
    if (!onProgressChange) return
    const t = setTimeout(() => {
      onProgressChange(buildSnapshot(dataRef.current, nodes, earnedXP, streak))
    }, 400)
    return () => clearTimeout(t)
  }, [nodes, earnedXP, streak, onProgressChange])

  /* Firestore: debounced save (savedRoadmapId aane par bhi yahi effect chalega — pehle complete kiye hue nodes save ho jate hain) */
  useEffect(() => {
    if (!user?.uid || !savedRoadmapId) return
    const id = savedRoadmapId
    const timer = setTimeout(() => {
      const snapshot = buildSnapshot(dataRef.current, nodes, earnedXP, streak)
      updateUserRoadmap(user.uid, id, {
        topic: snapshot.topic || snapshot.title || snapshot.goal || 'My roadmap',
        roadmapData: snapshot,
      }).catch((err) => console.error('Autosave failed:', err))
    }, 450)
    return () => clearTimeout(timer)
  }, [nodes, earnedXP, streak, user?.uid, savedRoadmapId])

  const totalXP    = data?.total_xp || nodes.reduce((s, n) => s + (n.xp_reward || 100), 0)
  const doneCount  = nodes.filter(n => n.status === 'done').length

  /* Roadmap complete = all main nodes done (bonus is optional) */
  const mainNodes  = nodes.filter(n => n.type !== 'bonus')
  const allDone    = mainNodes.length > 0 && mainNodes.every(n => n.status === 'done')

  const pct    = nodes.length ? Math.round(doneCount / nodes.length * 100) : 0
  const title  = data?.title || data?.goal || 'Your Roadmap'

  const pos   = layoutNodes(nodes)
  const conns = buildConnectors(nodes, pos)

  const coordList = Object.values(pos)
  const maxX = (coordList.length ? Math.max(...coordList.map((p) => p.x), 0) : 185) + 80
  const maxY = (coordList.length ? Math.max(...coordList.map((p) => p.y), 0) : 120) + 80
  const svgW = Math.max(maxX + 60, 420)
  const svgH = allDone ? maxY + 180 : maxY + 40

  function getState(n) {
    if (n.status === 'done')   return 'done'
    if (n.status === 'active') return 'active'
    return 'locked'
  }

  /* Complete a node → unlock next, auto-select it */
  const handleComplete = useCallback((node) => {
    const idx = nodes.findIndex(n => n.id === node.id)
    if (idx < 0) return

    const next = nodes.map((n, i) => i === idx ? { ...n, status: 'done' } : n)
    const ni   = next.findIndex((n, i) => i > idx && n.type !== 'bonus' && n.status === 'locked')
    if (ni >= 0) next[ni] = { ...next[ni], status: 'active' }

    setNodes(next)
    setEarnedXP(p => p + (node.xp_reward || 100))
    setStreak(s => s + 1)

    /* Auto-open the next unlocked node, or close panel if none left */
    setSelected(ni >= 0 ? next[ni] : null)

    const cx = window.innerWidth / 2 - (selected ? 170 : 0)
    const cy = window.innerHeight / 3
    setConfetti({ x: cx, y: cy, key: Date.now() })
    setXpFloat({ xp: node.xp_reward || 100, x: cx - 40, y: cy - 60, key: Date.now() })
  }, [nodes, selected])

  /* Unlock bonus node by spending XP */
  const handleUnlockBonus = useCallback((node) => {
    const cost = node.xp_reward || 250
    if (earnedXP < cost) return
    setEarnedXP(p => p - cost)
    const unlocked = { ...node, status: 'active' }
    setNodes(prev => prev.map(n => n.id === node.id ? unlocked : n))
    setSelected(unlocked)
  }, [earnedXP])

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

      {nodes.length === 0 && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32, textAlign: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>This roadmap has no steps yet</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 380, lineHeight: 1.6 }}>
            The server returned data we could not map to nodes (check the browser console and that{' '}
            <code style={{ color: 'rgba(255,255,255,0.6)' }}>VITE_API_URL</code>{' '}
            points at your running API). Try generating again or go home.
          </div>
          <button
            type="button"
            onClick={onBack}
            style={{
              marginTop: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', padding: '10px 22px', borderRadius: 10, cursor: 'pointer', fontSize: 14,
            }}
          >
            ← Home
          </button>
        </div>
      )}

      {nodes.length > 0 && (<>
      {/* ── TOP INFO BAR ── */}
      <div style={{
        position: 'relative', zIndex: 50,
        padding: '18px 24px 14px',
        background: 'var(--bg, #0a0a0a)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexShrink: 0,
        paddingRight: selected ? 'calc(340px + 24px)' : '24px',
        transition: 'padding-right 0.22s ease',
      }}>
        <div style={{ minWidth: 0, flex: 1, marginRight: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>
            {doneCount}/{nodes.length} nodes · personalized journey
            {savedRoadmapId && user?.uid && (
              <span style={{ color: 'rgba(16,185,129,0.75)' }}> · Auto-saved</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#e52929', fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
              {pct}%
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              {doneCount}/{nodes.length} nodes
            </div>
          </div>

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

          <div style={{
            padding: '6px 14px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 100, display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
          }}>
            🔥 {streak} day streak
          </div>

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
                  stroke={c.isBonus ? 'rgba(202,154,4,0.2)' : c.isDone ? 'rgba(229,41,41,0.35)' : 'rgba(255,255,255,0.1)'}
                  strokeWidth={c.isBonus ? 1.5 : 2}
                  strokeDasharray={c.isBonus ? '5 4' : c.isDone ? 'none' : '7 5'}
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

            {/* All-done trophy — shows when all main nodes are complete */}
            {allDone && (
              <g transform={`translate(${svgW / 2},${maxY + 40})`}>
                <text textAnchor="middle" fontSize={38}>🏆</text>
                <text textAnchor="middle" y={46} fontSize={14} fill="#fbbf24" fontWeight={700}>Main Path Complete!</text>
                <text textAnchor="middle" y={64} fontSize={11} fill="rgba(255,255,255,0.38)">
                  {earnedXP} XP earned · {streak} day streak
                </text>
                {nodes.some(n => n.type === 'bonus' && n.status === 'locked') && (
                  <text textAnchor="middle" y={90} fontSize={11} fill="#ca9a04">
                    ★ Unlock the bonus path with your XP!
                  </text>
                )}
              </g>
            )}
          </svg>
        </div>

        {/* Panel */}
        {selected && (
          <NodePanel
            node={selected}
            state={getState(selected)}
            onClose={() => setSelected(null)}
            onComplete={handleComplete}
            onResourceClick={setActiveResource}
            earnedXP={earnedXP}
            onUnlock={handleUnlockBonus}
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
        {[['#e52929','Active'],['#555','Done'],['rgba(255,255,255,0.2)','Locked'],['#ca9a04','Bonus']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, border: l === 'Locked' ? '1px dashed rgba(255,255,255,0.3)' : 'none' }} />{l}
          </div>
        ))}
      </div>

      {confetti && <Confetti key={confetti.key} x={confetti.x} y={confetti.y} />}
      {xpFloat  && <XPFloat  key={xpFloat.key}  xp={xpFloat.xp} x={xpFloat.x} y={xpFloat.y} />}

      <ChatButton
        roadmap={roadmapForChat}
        currentModule={selected}
        currentResource={activeResource}
      />
      </>)}
    </div>
  )
}
