// src/pages/RoadmapPage.jsx
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import ChatButton from '../components/ChatButton.jsx'
import { saveRoadmap, updateNodeCompletion } from '../lib/firestore'

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
    pos[n.id] = { x: CX + Math.sin(i * 1.15) * AMP, y: 100 + i * RH }
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
  const isBonus     = node.type === 'bonus'
  const isCheckpoint = node.type === 'checkpoint'
  const isDone      = state === 'done'
  const isActive    = state === 'active'
  const isLocked    = state === 'locked'
  const r           = isBonus ? 24 : isActive ? 40 : isDone ? 24 : 28

  const fill   = isDone      ? '#3a3a3a'
               : isCheckpoint ? (isLocked ? 'rgba(217,119,6,0.06)' : 'rgba(217,119,6,0.18)')
               : isBonus      ? (isLocked ? 'rgba(202,154,4,0.06)' : 'rgba(202,154,4,0.18)')
               : isActive     ? '#e52929'
               :                 'rgba(255,255,255,0.03)'

  const stroke = isDone      ? '#555'
               : isCheckpoint ? (isLocked ? 'rgba(217,119,6,0.3)' : '#d97706')
               : isBonus      ? (isLocked ? 'rgba(202,154,4,0.3)' : '#ca9a04')
               : isActive     ? '#e52929'
               :                 'rgba(255,255,255,0.2)'

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
          stroke={isCheckpoint ? '#d97706' : isBonus ? '#ca9a04' : '#e52929'}
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
        fontSize={isLocked ? 14 : isBonus || isCheckpoint ? 16 : 18}
        style={{ userSelect: 'none' }}
        fill={isDone ? '#888' : isLocked ? '#666' : '#fff'}
      >
        {isDone ? '✓' : isCheckpoint ? '📝' : isBonus ? '★' : isLocked ? '🔒' : (node.emoji || '●')}
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

/* ── Quiz Modal ──────────────────────────────────────────────────────────────*/
function QuizModal({ node, onClose, onComplete }) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const questions = node.quiz_questions || []
  if (questions.length === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          background: '#111', borderRadius: 16, padding: 32, maxWidth: 500, border: '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 12 }}>📝 Checkpoint Quiz</div>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
            This checkpoint doesn't have quiz questions yet. Mark it as complete to continue!
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px 16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 10, cursor: 'pointer' }}>Cancel</button>
            <button onClick={onComplete} style={{ flex: 1, padding: '10px 16px', background: '#d97706', border: 'none', color: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>Complete Checkpoint</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[current]
  const correctAnswer = selected[current] === q.correct_index
  const answered = current in selected
  const allAnswered = questions.length === Object.keys(selected).length
  const correct = Object.keys(selected).filter(i => selected[i] === questions[i].correct_index).length

  const handleSubmit = () => {
    setSubmitted(true)
  }

  const handleComplete = () => {
    onComplete(correct, questions.length)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#111', borderRadius: 16, padding: 32, maxWidth: 600, minWidth: 400,
        border: '1px solid rgba(255,255,255,0.1)', maxHeight: '80vh', overflowY: 'auto',
      }}>
        {!submitted ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>📝 {node.title} - Quiz</div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Question {current + 1} of {questions.length}</div>
              <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                <div style={{ width: `${((current + 1) / questions.length) * 100}%`, height: '100%', background: '#d97706', borderRadius: 2 }} />
              </div>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 16 }}>{q.question}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {(q.options || []).map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setSelected({ ...selected, [current]: i })}
                  style={{
                    padding: '12px 14px', textAlign: 'left', borderRadius: 10, border: `1.5px solid ${selected[current] === i ? '#d97706' : 'rgba(255,255,255,0.1)'}`,
                    background: selected[current] === i ? 'rgba(217,119,6,0.15)' : 'rgba(255,255,255,0.03)',
                    color: '#fff', cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected[current] === i ? '#d97706' : 'rgba(255,255,255,0.2)'}`,
                      background: selected[current] === i ? '#d97706' : 'transparent',
                    }} />
                    <span>{opt}</span>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setCurrent(Math.max(0, current - 1))}
                disabled={current === 0}
                style={{ flex: 1, padding: '10px 16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', color: current === 0 ? 'rgba(255,255,255,0.3)' : '#fff', borderRadius: 10, cursor: current === 0 ? 'not-allowed' : 'pointer' }}
              >
                ← Back
              </button>
              {current < questions.length - 1 ? (
                <button
                  onClick={() => setCurrent(current + 1)}
                  disabled={!answered}
                  style={{ flex: 1, padding: '10px 16px', background: answered ? '#d97706' : 'rgba(217,119,6,0.2)', border: 'none', color: '#fff', borderRadius: 10, cursor: answered ? 'pointer' : 'not-allowed', fontWeight: 600 }}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!allAnswered}
                  style={{ flex: 1, padding: '10px 16px', background: allAnswered ? '#10b981' : 'rgba(16,185,129,0.2)', border: 'none', color: '#fff', borderRadius: 10, cursor: allAnswered ? 'pointer' : 'not-allowed', fontWeight: 600 }}
                >
                  Submit
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {correct === questions.length ? '🎉' : correct >= questions.length * 0.7 ? '👍' : '📚'}
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                {correct}/{questions.length} Correct!
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                {correct === questions.length ? 'Perfect score! 🌟' : correct >= questions.length * 0.7 ? 'Great job!' : 'Keep learning!'}
              </p>
            </div>
            <button
              onClick={handleComplete}
              style={{ width: '100%', padding: '14px', background: '#10b981', border: 'none', color: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 16 }}
            >
              Continue to Next Node
            </button>
          </>
        )}
      </div>
    </div>
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
export default function RoadmapPage({ data, onBack }) {
  const { user, profile } = useAuth()
  const [nodes,    setNodes]    = useState(() => normalise(data))
  const [selected, setSelected] = useState(null)
  const [earnedXP, setEarnedXP] = useState(0)
  const [streak,   setStreak]   = useState(profile?.streak || 0)
  const [confetti, setConfetti] = useState(null)
  const [xpFloat,  setXpFloat]  = useState(null)
  const [activeResource, setActiveResource] = useState(null)
  const [roadmapId, setRoadmapId] = useState(data?.id || `roadmap_${Date.now()}`)
  const [timeframe, setTimeframe] = useState(data?.timeframe || '')
  const [editingTimeframe, setEditingTimeframe] = useState(false)
  const [timeframeInput, setTimeframeInput] = useState(timeframe)
  const [quizNode, setQuizNode] = useState(null)

  // Update local streak when profile changes
  useEffect(() => {
    if (profile?.streak !== undefined) {
      setStreak(profile.streak)
    }
  }, [profile?.streak])

  // Update timeframeInput when timeframe changes
  useEffect(() => {
    setTimeframeInput(timeframe)
  }, [timeframe])

  // Save roadmap to Firestore on first load (authenticated users only)
  useEffect(() => {
    if (user && data && !data.firestoreSaved) {
      (async () => {
        try {
          await saveRoadmap(user.uid, roadmapId, {
            ...data,
            id: roadmapId,
          })
          // Mark as saved to prevent re-saving
          data.firestoreSaved = true
        } catch (error) {
          console.error('Error saving roadmap:', error)
        }
      })()
    }
  }, [user, data, roadmapId])

  const handleTimeframeUpdate = async () => {
    if (!timeframeInput.trim() || timeframeInput === timeframe) {
      setEditingTimeframe(false)
      return
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/roadmap/${roadmapId}/timeframe`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roadmap_id: roadmapId, timeframe: timeframeInput }),
        }
      )

      if (res.ok) {
        setTimeframe(timeframeInput)
        setEditingTimeframe(false)
        // Also update Firestore if user is authenticated
        if (user) {
          try {
            const { updateRoadmap: updateRoadmapFS } = await import('../lib/firestore')
            await updateRoadmapFS(user.uid, roadmapId, { timeframe: timeframeInput })
          } catch (err) {
            console.error('Error updating Firestore:', err)
          }
        }
      }
    } catch (error) {
      console.error('Error updating timeframe:', error)
      setEditingTimeframe(false)
    }
  }

  const totalXP    = data?.total_xp || nodes.reduce((s, n) => s + (n.xp_reward || 100), 0)
  const doneCount  = nodes.filter(n => n.status === 'done').length

  /* Roadmap complete = all main nodes done (bonus is optional) */
  const mainNodes  = nodes.filter(n => n.type !== 'bonus')
  const allDone    = mainNodes.length > 0 && mainNodes.every(n => n.status === 'done')

  const pct    = nodes.length ? Math.round(doneCount / nodes.length * 100) : 0
  const title  = data?.title || data?.goal || 'Your Roadmap'

  const pos   = layoutNodes(nodes)
  const conns = buildConnectors(nodes, pos)

  const maxX = Math.max(...Object.values(pos).map(p => p.x), 0) + 80
  const maxY = Math.max(...Object.values(pos).map(p => p.y), 0) + 80
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

    // If it's a checkpoint, show the quiz modal
    if (node.type === 'checkpoint') {
      setQuizNode(node)
      return
    }

    const next = nodes.map((n, i) => i === idx ? { ...n, status: 'done' } : n)
    const ni   = next.findIndex((n, i) => i > idx && n.type !== 'bonus' && n.status === 'locked')
    if (ni >= 0) next[ni] = { ...next[ni], status: 'active' }

    setNodes(next)
    const xpReward = node.xp_reward || 100
    setEarnedXP(p => p + xpReward)
    setStreak(s => s + 1)

    // Save node completion to Firestore (if user is authenticated)
    if (user) {
      updateNodeCompletion(user.uid, roadmapId, node.id, true, xpReward).catch(error => {
        console.error('Error updating node completion:', error)
      })
    }

    /* Auto-open the next unlocked node, or close panel if none left */
    setSelected(ni >= 0 ? next[ni] : null)

    const cx = window.innerWidth / 2 - (selected ? 170 : 0)
    const cy = window.innerHeight / 3
    setConfetti({ x: cx, y: cy, key: Date.now() })
    setXpFloat({ xp: xpReward, x: cx - 40, y: cy - 60, key: Date.now() })
  }, [nodes, selected, user, roadmapId])

  const handleQuizComplete = useCallback((correct, total) => {
    // Mark checkpoint as done with bonus XP
    const idx = nodes.findIndex(n => n.id === quizNode.id)
    if (idx < 0) return

    const baseXP = quizNode.xp_reward || 50
    const bonusXP = correct === total ? 50 : Math.round((correct / total) * 25)
    const totalXP = baseXP + bonusXP

    const next = nodes.map((n, i) => i === idx ? { ...n, status: 'done' } : n)
    const ni   = next.findIndex((n, i) => i > idx && n.type !== 'bonus' && n.status === 'locked')
    if (ni >= 0) next[ni] = { ...next[ni], status: 'active' }

    setNodes(next)
    setEarnedXP(p => p + totalXP)
    setStreak(s => s + 1)
    setQuizNode(null)

    // Save to Firestore
    if (user) {
      updateNodeCompletion(user.uid, roadmapId, quizNode.id, true, totalXP).catch(err => {
        console.error('Error updating checkpoint:', err)
      })
    }

    setSelected(ni >= 0 ? next[ni] : null)
    const cx = window.innerWidth / 2 - (selected ? 170 : 0)
    const cy = window.innerHeight / 3
    setConfetti({ x: cx, y: cy, key: Date.now() })
    setXpFloat({ xp: totalXP, x: cx - 40, y: cy - 60, key: Date.now() })
  }, [nodes, quizNode, selected, user, roadmapId])

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>
              {title}
            </div>
            {timeframe && (
              <button
                onClick={() => setEditingTimeframe(true)}
                style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', fontSize: 14, padding: '0 4px', transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.color = 'rgba(255,255,255,0.8)'}
                onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.5)'}
              >
                ✎
              </button>
            )}
          </div>
          {editingTimeframe ? (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={timeframeInput}
                onChange={(e) => setTimeframeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTimeframeUpdate()
                  if (e.key === 'Escape') setEditingTimeframe(false)
                }}
                autoFocus
                style={{
                  padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(229,41,41,0.4)',
                  background: 'rgba(229,41,41,0.08)', color: '#fff', fontSize: 12,
                  fontFamily: 'inherit', outline: 'none',
                }}
                placeholder="e.g. 4-6 weeks"
              />
              <button
                onClick={handleTimeframeUpdate}
                style={{
                  padding: '4px 10px', borderRadius: 6, background: 'rgba(229,41,41,0.2)',
                  border: '1px solid rgba(229,41,41,0.3)', color: '#e52929', fontSize: 11,
                  cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(229,41,41,0.3)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(229,41,41,0.2)'}
              >
                Save
              </button>
              <button
                onClick={() => setEditingTimeframe(false)}
                style={{
                  padding: '4px 10px', borderRadius: 6, background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)',
                  fontSize: 11, cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.4)'}
                onMouseLeave={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>
              {doneCount}/{nodes.length} nodes {timeframe ? `· ${timeframe}` : '· personalized journey'}
            </div>
          )}
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
            🔥 {user ? streak : 0} day streak
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
          paddingTop: 60,
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
        padding: '9px 14px', display: 'flex', gap: 14, flexWrap: 'wrap',
        fontSize: 11, color: 'rgba(255,255,255,0.45)', zIndex: 30,
      }}>
        {[['#e52929','Active'],['#555','Done'],['rgba(255,255,255,0.2)','Locked'],['#d97706','Checkpoint'],['#ca9a04','Bonus']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, border: l === 'Locked' ? '1px dashed rgba(255,255,255,0.3)' : 'none' }} />{l}
          </div>
        ))}
      </div>

      {quizNode && (
        <QuizModal
          node={quizNode}
          onClose={() => setQuizNode(null)}
          onComplete={handleQuizComplete}
        />
      )}

      {confetti && <Confetti key={confetti.key} x={confetti.x} y={confetti.y} />}
      {xpFloat  && <XPFloat  key={xpFloat.key}  xp={xpFloat.xp} x={xpFloat.x} y={xpFloat.y} />}

      <ChatButton
        roadmap={data}
        currentModule={selected}
        currentResource={activeResource}
      />
    </div>
  )
}
