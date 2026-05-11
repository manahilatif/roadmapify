// src/pages/LandingPage.jsx
import { useState } from 'react'
import Navbar from '../components/Navbar.jsx'

/* ─── Example roadmaps data ────────────────────────────────── */
const EXAMPLES = [
  {
    emoji: '📸',
    title: 'Build an Instagram clone',
    tag: 'Full-stack project',
    tagColor: 'rgba(229,41,41,0.12)',
    tagTextColor: 'var(--r3)',
    tagBorder: 'rgba(229,41,41,0.22)',
    desc: 'Design, build, and deploy a photo-sharing app with auth, feeds, and image uploads.',
    weeks: 16,
    hoursPerWeek: 10,
    level: 'intermediate',
    goal: 'project',
    topic: 'build an Instagram clone with React, Node.js, and PostgreSQL',
    preview: ['UI & Auth', 'Posts & Feeds', 'Image Storage', 'Notifications', 'Deploy'],
  },
  {
    emoji: '🎓',
    title: 'Prep for IELTS',
    tag: 'Exam prep',
    tagColor: 'rgba(234,179,8,0.1)',
    tagTextColor: '#fbbf24',
    tagBorder: 'rgba(234,179,8,0.2)',
    desc: 'Hit your band score target with a structured plan covering all four skills.',
    weeks: 8,
    hoursPerWeek: 8,
    level: 'intermediate',
    goal: 'job',
    topic: 'prepare for IELTS and achieve a band score of 7.0',
    preview: ['Listening', 'Reading', 'Writing', 'Speaking', 'Mock Tests'],
  },
  {
    emoji: '🎨',
    title: 'Become a UI designer',
    tag: 'Creative career',
    tagColor: 'rgba(139,92,246,0.12)',
    tagTextColor: '#a78bfa',
    tagBorder: 'rgba(139,92,246,0.22)',
    desc: 'Go from zero to portfolio-ready — Figma, design systems, and real project work.',
    weeks: 12,
    hoursPerWeek: 6,
    level: 'beginner',
    goal: 'job',
    topic: 'become a UI/UX designer with a strong Figma portfolio',
    preview: ['Design Basics', 'Figma', 'Typography', 'Design Systems', 'Portfolio'],
  },
]

function MiniNodes({ steps }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '14px' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            background: i === 0 ? 'var(--r4)' : 'var(--s2)',
            border: `1px solid ${i === 0 ? 'var(--r4)' : 'var(--border-md)'}`,
            borderRadius: '20px', padding: '3px 10px',
            fontSize: '0.7rem', color: i === 0 ? '#fff' : 'var(--ts)',
            fontFamily: "'Syne', sans-serif", fontWeight: 600, whiteSpace: 'nowrap',
          }}>{s}</div>
          {i < steps.length - 1 && (
            <div style={{ width: '12px', height: '1px', background: 'var(--border-md)', flexShrink: 0 }} />
          )}
        </div>
      ))}
    </div>
  )
}

function ExamplesModal({ onClose, onUseExample }) {
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.76)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div style={{
        width: '100%', maxWidth: '680px',
        background: 'var(--s0)',
        border: '1px solid var(--border-md)',
        borderRadius: '22px',
        padding: '32px 28px',
        animation: 'fadeUp 0.22s var(--ease)',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'var(--s2)', border: '1px solid var(--border)',
          borderRadius: '8px', width: '30px', height: '30px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--ts)', fontSize: '16px', lineHeight: 1,
        }}>×</button>

        <div style={{ marginBottom: '24px' }}>
          <div className="badge badge-red" style={{ marginBottom: '10px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#e52929', display: 'inline-block' }} />
            Example roadmaps
          </div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>See what Roadmapify builds</h2>
          <p style={{ fontSize: '0.8375rem', color: 'var(--ts)', lineHeight: 1.6 }}>
            Click any example to jump straight into onboarding with it pre-filled.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {EXAMPLES.map((ex, i) => (
            <div
              key={i}
              onClick={() => onUseExample(ex)}
              style={{
                background: 'var(--s1)', border: '1px solid var(--border)',
                borderRadius: '16px', padding: '20px 22px',
                cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(229,41,41,0.3)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: 'var(--s2)', border: '1px solid var(--border-md)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', flexShrink: 0,
                  }}>{ex.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.9375rem' }}>{ex.title}</span>
                      <span style={{
                        fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 600,
                        background: ex.tagColor, color: ex.tagTextColor, border: `1px solid ${ex.tagBorder}`,
                        fontFamily: "'Syne', sans-serif", letterSpacing: '0.04em',
                      }}>{ex.tag}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--ts)', lineHeight: 1.55, margin: 0 }}>{ex.desc}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>{ex.weeks} weeks</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--tm)', whiteSpace: 'nowrap' }}>{ex.hoursPerWeek} hrs/wk</div>
                </div>
              </div>
              <MiniNodes steps={ex.preview} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button className="btn btn-ghost" style={{ fontSize: '0.8125rem' }} onClick={onClose}>
            I'll describe my own goal instead
          </button>
        </div>
      </div>
    </div>
  )
}

function MapPreview() {
  const nodes = [
    { x: 170, y: 52,  state: 'done',   label: 'Basics'     },
    { x: 240, y: 122, state: 'done',   label: 'Variables'  },
    { x: 148, y: 192, state: 'done',   label: 'Functions'  },
    { x: 228, y: 262, state: 'active', label: 'Arrays'     },
    { x: 318, y: 182, state: 'bonus',  label: 'Regex',  isBonus: true },
    { x: 158, y: 332, state: 'locked', label: 'OOP'        },
    { x: 238, y: 402, state: 'locked', label: 'Algorithms' },
  ]
  const lines = [
    { x1: 170, y1: 52,  x2: 240, y2: 122 },
    { x1: 240, y1: 122, x2: 148, y2: 192 },
    { x1: 148, y1: 192, x2: 228, y2: 262 },
    { x1: 228, y1: 262, x2: 158, y2: 332 },
    { x1: 158, y1: 332, x2: 238, y2: 402 },
    { x1: 240, y1: 122, x2: 318, y2: 182, bonus: true },
  ]
  return (
    <div style={{ position: 'relative', maxWidth: '400px', margin: '0 auto' }}>
      <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%,-50%)', width: '280px', height: '280px', background: 'radial-gradient(circle,rgba(229,41,41,0.11) 0%,transparent 70%)', pointerEvents: 'none' }} />
      <svg viewBox="0 0 400 455" style={{ width: '100%', overflow: 'visible' }}>
        {lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={l.bonus ? 'rgba(202,154,4,0.28)' : 'rgba(229,41,41,0.18)'}
            strokeWidth={l.bonus ? 1.5 : 2} strokeDasharray={l.bonus ? '5 4' : '7 5'}
            style={{ animation: `pathDraw 1s ease forwards ${i * 0.12}s`, strokeDashoffset: 900 }}
          />
        ))}
        {nodes.map((n, i) => {
          const r = n.isBonus ? 22 : 26
          const isDone = n.state === 'done', isActive = n.state === 'active'
          const isBonus = n.state === 'bonus', isLocked = n.state === 'locked'
          return (
            <g key={i} style={{ animation: `fadeUp 0.4s ease both ${0.25 + i * 0.09}s`, opacity: 0 }}>
              {isActive && <>
                <circle cx={n.x} cy={n.y} r={r + 12} fill="none" stroke="rgba(229,41,41,0.35)" strokeWidth="1.5" style={{ animation: 'pulse-ring 2s ease-out infinite' }} />
                <circle cx={n.x} cy={n.y} r={r + 22} fill="none" stroke="rgba(229,41,41,0.12)" strokeWidth="1" style={{ animation: 'pulse-ring 2s ease-out 0.5s infinite' }} />
              </>}
              <circle cx={n.x} cy={n.y} r={r}
                fill={isDone ? '#1c1c1c' : isActive ? '#e52929' : isBonus ? '#1e1800' : '#181818'}
                stroke={isDone ? '#3a3a3a' : isActive ? '#e52929' : isBonus ? '#ca9a04' : '#2a2a2a'}
                strokeWidth={isActive ? 2.5 : 1.5}
                style={isActive ? { filter: 'drop-shadow(0 0 12px rgba(229,41,41,0.55))' } : {}}
              />
              <text x={n.x} y={n.y + 6} textAnchor="middle" style={{ fontSize: isActive ? '11px' : '15px', fontFamily: "'Syne',sans-serif", fontWeight: 800, fill: isDone ? '#444' : isActive ? '#fff' : isBonus ? '#ca9a04' : '#333', userSelect: 'none', pointerEvents: 'none' }}>
                {isDone ? '✓' : isActive ? 'NOW' : isBonus ? '★' : '🔒'}
              </text>
              <text x={n.x} y={n.y + r + 16} textAnchor="middle" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '11px', fill: isLocked ? '#3a3a3a' : isBonus ? '#ca9a04' : isActive ? '#f87171' : '#5a5a5a', fontWeight: isActive ? 600 : 400, userSelect: 'none', pointerEvents: 'none' }}>
                {n.label}
              </text>
            </g>
          )
        })}
        <g style={{ animation: 'float 3s ease-in-out infinite' }}>
          <rect x="286" y="46" width="84" height="24" rx="12" fill="rgba(234,179,8,0.1)" stroke="rgba(234,179,8,0.25)" strokeWidth="1" />
          <text x="328" y="62" textAnchor="middle" style={{ fontFamily: "'Syne',sans-serif", fontSize: '10px', fontWeight: 700, fill: '#fbbf24', letterSpacing: '0.03em', userSelect: 'none' }}>+150 XP</text>
        </g>
        <g style={{ animation: 'float 3.5s 0.5s ease-in-out infinite' }}>
          <rect x="14" y="362" width="104" height="24" rx="12" fill="rgba(229,41,41,0.1)" stroke="rgba(229,41,41,0.2)" strokeWidth="1" />
          <text x="66" y="378" textAnchor="middle" style={{ fontFamily: "'Syne',sans-serif", fontSize: '10px', fontWeight: 700, fill: '#f87171', userSelect: 'none' }}>🔥 7 day streak</text>
        </g>
      </svg>
    </div>
  )
}

function FeatureCard({ icon, title, desc, delay }) {
  return (
    <div className="anim-up" style={{ animationDelay: `${delay}s`, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: '18px', padding: '24px', transition: 'border-color 0.2s, transform 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(229,41,41,0.28)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ width: '40px', height: '40px', background: 'rgba(229,41,41,0.1)', border: '1px solid rgba(229,41,41,0.18)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '14px' }}>{icon}</div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.9375rem', marginBottom: '7px' }}>{title}</div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--ts)', lineHeight: 1.65 }}>{desc}</div>
    </div>
  )
}

export default function LandingPage({ onStart, onStartWithExample, onMyRoadmaps }) {
  const [showExamples, setShowExamples] = useState(false)

  const handleUseExample = (ex) => {
    setShowExamples(false)
    onStartWithExample({
      topic:        ex.topic,
      goal:         ex.goal,
      level:        ex.level,
      hoursPerWeek: ex.hoursPerWeek,
      weeks:        ex.weeks,
    })
  }

  return (
    <div className="noise" style={{ minHeight: '100vh', background: 'var(--black)' }}>
      <Navbar onStart={onStart} onMyRoadmaps={onMyRoadmaps} />

      {/* Hero */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: '60px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(229,41,41,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(229,41,41,0.035) 1px,transparent 1px)', backgroundSize: '46px 46px', maskImage: 'radial-gradient(ellipse 80% 60% at 46% 40%,black 20%,transparent 100%)' }} />
        <div style={{ position: 'absolute', top: '28%', left: '8%', width: '400px', height: '400px', background: 'radial-gradient(circle,rgba(229,41,41,0.07) 0%,transparent 65%)', pointerEvents: 'none' }} />

        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div>
            <div className="badge badge-red anim-up" style={{ marginBottom: '20px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#e52929', display: 'inline-block' }} />
              AI Powered Learning
            </div>
            <h1 className="anim-up delay-1" style={{ fontSize: 'clamp(2.4rem,4.5vw,3.6rem)', marginBottom: '20px' }}>
              Your learning<br />journey, now<br /><span className="grad-text">gamified.</span>
            </h1>
            <p className="anim-up delay-2" style={{ fontSize: '1rem', color: 'var(--ts)', lineHeight: 1.72, maxWidth: '420px', marginBottom: '36px' }}>
              Tell us what you want to learn and how fast you want to get there.
              Roadmapify builds a personalized journey — nodes, streaks, bonus paths and all.
            </p>
            <div className="anim-up delay-3" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={onStart}>
                Build my roadmap
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {/* ✅ FIXED: onClick now opens the examples modal */}
              <button className="btn btn-ghost btn-lg" onClick={() => setShowExamples(true)}>
                See examples
              </button>
            </div>
            <div className="anim-up delay-4" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex' }}>
                {['#e52929', '#c41c1c', '#9b1414', '#7a0d0d'].map((c, i) => (
                  <div key={i} style={{ width: '26px', height: '26px', borderRadius: '50%', background: c, border: '2px solid var(--black)', marginLeft: i > 0 ? '-8px' : 0 }} />
                ))}
              </div>
              <span style={{ fontSize: '0.8125rem', color: 'var(--ts)' }}>
                Trusted by <strong style={{ color: 'var(--tp)' }}>2,400+</strong> learners
              </span>
            </div>
          </div>
          <div className="anim-up delay-2"><MapPreview /></div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: 'var(--s0)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '32px 0' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
          {[['48+', 'Learning domains'], ['2.4k', 'Active learners'], ['91%', 'Goal completion'], ['4.8★', 'Average rating']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.04em', background: 'linear-gradient(135deg,#ff6b6b,#e52929)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{v}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ts)', marginTop: '3px' }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '88px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <div className="badge badge-red anim-up" style={{ marginBottom: '14px' }}>Why Roadmapify</div>
            <h2 className="anim-up delay-1" style={{ fontSize: 'clamp(1.65rem,3vw,2.4rem)', maxWidth: '500px', margin: '0 auto 12px' }}>Not a list of links.<br />A living journey.</h2>
            <p className="anim-up delay-2" style={{ color: 'var(--ts)', maxWidth: '440px', margin: '0 auto', fontSize: '0.9rem' }}>
              Every roadmap adapts to your speed — tightening your main path and surfacing bonus side quests when you're on a roll.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
            <FeatureCard icon="🗺️" title="Dynamic node maps"    desc="Visual journey with unlockable nodes — main path plus optional bonus branches for depth-seekers." delay={0.1} />
            <FeatureCard icon="⚡" title="Adapts to your speed" desc="Finish early? The map reshuffles. Fall behind? We ease the curve. Your pace drives everything."     delay={0.2} />
            <FeatureCard icon="🤖" title="AI-curated resources" desc="Each node links to the best videos, docs, and exercises — ranked by quality, not just popularity."  delay={0.3} />
            <FeatureCard icon="🔥" title="Streaks and XP"       desc="Daily check-ins earn XP. Streaks multiply your rewards. Progress feels like playing, not grinding." delay={0.4} />
            <FeatureCard icon="🌿" title="Bonus side paths"     desc="Star nodes sit just off the main path — optional deep dives that reward the curious."              delay={0.5} />
            <FeatureCard icon="🎯" title="Goal-first design"    desc="Tell us your deadline and goal. We work backwards to build a realistic, week-by-week plan."         delay={0.6} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '88px 0', borderTop: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 80% at 50% 50%,rgba(229,41,41,0.055) 0%,transparent 70%)' }} />
        <div className="container-narrow" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', marginBottom: '18px' }}>Ready to start your<br /><span className="grad-text">quest?</span></h2>
          <p style={{ color: 'var(--ts)', fontSize: '0.9375rem', marginBottom: '32px', lineHeight: 1.7 }}>Takes under 2 minutes. No account needed to try it.</p>
          <button className="btn btn-primary btn-lg" onClick={onStart} style={{ fontSize: '1rem', padding: '16px 36px' }}>Build my roadmap — free</button>
        </div>
      </section>

      {/* Footer — ✅ GitHub link fixed */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1140px', margin: '0 auto' }}>
        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.875rem' }}>road<span style={{ color: '#e52929' }}>mapify</span></span>
        <span style={{ fontSize: '0.75rem', color: 'var(--tm)' }}>© 2026 Roadmapify</span>
        <div style={{ display: 'flex', gap: '18px' }}>
          <a href="#" style={{ fontSize: '0.75rem', color: 'var(--tm)' }}>Privacy</a>
          <a href="#" style={{ fontSize: '0.75rem', color: 'var(--tm)' }}>Terms</a>
          <a href="https://github.com/manahilatif/roadmapify" target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--tm)' }}>GitHub</a>
        </div>
      </footer>

      {showExamples && (
        <ExamplesModal onClose={() => setShowExamples(false)} onUseExample={handleUseExample} />
      )}
    </div>
  )
}