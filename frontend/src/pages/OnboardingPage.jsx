// src/pages/OnboardingPage.jsx
import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar.jsx'

// ── Timeframe fallbacks per goal type ─────────────────────────────────────────
const TIMEFRAME_DEFAULTS = {
  one_time: [
    { v: '30_min',   l: '30 minutes', d: 'Quick session' },
    { v: '1_2_hrs',  l: '1–2 hours',  d: 'Focused block' },
    { v: 'half_day', l: 'Half a day', d: 'Morning project' },
    { v: 'full_day', l: 'Full day',   d: 'Deep immersion' },
  ],
  skill: [
    { v: '2_weeks',  l: '2 weeks',  d: 'Intense sprint' },
    { v: '1_month',  l: '1 month',  d: 'Steady pace' },
    { v: '3_months', l: '3 months', d: 'Comfortable' },
    { v: '6_months', l: '6 months', d: 'Deep mastery' },
  ],
  project: [
    { v: '1_week',   l: '1 week',   d: 'Hackathon mode' },
    { v: '2_weeks',  l: '2 weeks',  d: 'Sprint' },
    { v: '1_month',  l: '1 month',  d: 'Steady build' },
    { v: '3_months', l: '3 months', d: 'Polish & launch' },
  ],
  habit: [
    { v: '1_week',   l: '1 week',   d: 'Try it out' },
    { v: '2_weeks',  l: '2 weeks',  d: 'Build the streak' },
    { v: '1_month',  l: '1 month',  d: 'Lock it in' },
    { v: '3_months', l: '3 months', d: 'Lifestyle change' },
  ],
}

// ── Steps ─────────────────────────────────────────────────────────────────────
const BASE_STEPS = [
  {
    id: 'goal', question: "What's your main goal?",
    sub: 'This helps us shape the kind of roadmap we build for you.',
    type: 'choice', field: 'goal',
    choices: [
      { v: 'job',     l: 'Reach a goal',       d: 'e.g. bake a cake, run a 5K, pass an exam' },
      { v: 'project', l: 'Create something',   d: 'e.g. knit a sweater, build an app, write a song' },
      { v: 'upskill', l: 'Get better at this', d: 'Improve a skill you already have' },
      { v: 'explore', l: 'Just exploring',      d: "Curious and want to see what it's about" },
    ],
  },
  {
    id: 'topic', question: 'What do you want to do?',
    sub: 'Be specific — "bake sourdough bread" works better than just "cooking".',
    type: 'text', field: 'topic',
    placeholder: 'e.g. bake a chocolate chip cookie, learn Spanish, crochet a beanie…',
  },
  {
    id: 'level', question: "What's your current level?",
    sub: 'We use this to skip what you already know.',
    type: 'choice', field: 'level',
    choices: [
      { v: 'beginner',     l: 'Beginner',     d: 'Just starting out' },
      { v: 'intermediate', l: 'Intermediate', d: 'Some experience' },
      { v: 'advanced',     l: 'Advanced',     d: 'Solid foundation' },
    ],
  },
  {
    id: 'hours', question: 'Hours per week you can commit?',
    sub: "Be honest — we'd rather plan a realistic journey.",
    type: 'slider', field: 'hoursPerWeek', min: 2, max: 40, unit: 'hrs/wk',
  },
  {
    id: 'weeks', question: 'Target completion in…',
    sub: 'Pick a timeframe that feels ambitious but doable.',
    type: 'choice', field: 'weeks',
    choices: TIMEFRAME_DEFAULTS.skill, // swapped dynamically after topic classify
  },
]

const DEFAULT_ANSWERS = { topic: '', level: '', goal: '', hoursPerWeek: 10, weeks: '' }

// ── Sub-components ────────────────────────────────────────────────────────────

function Dots({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginBottom: '36px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: '5px', borderRadius: '3px', transition: 'all 0.3s',
          background: i < step ? 'var(--r6)' : i === step ? 'var(--r4)' : 'var(--s3)',
          width: i === step ? '22px' : '5px',
        }} />
      ))}
    </div>
  )
}

function Choice({ c, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(c.v)}
      style={{
        width: '100%',
        background: selected ? 'rgba(229,41,41,0.09)' : 'var(--s1)',
        border: `1px solid ${selected ? '#e52929' : 'var(--border-md)'}`,
        borderRadius: '13px', padding: '15px 18px', cursor: 'pointer',
        textAlign: 'left', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', transition: 'all 0.14s',
        boxShadow: selected ? '0 0 0 1px #e52929' : 'none', marginBottom: '8px',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border-hi)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border-md)' }}
    >
      <div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '0.9rem', color: selected ? 'var(--r3)' : 'var(--tp)', marginBottom: '2px' }}>{c.l}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--ts)' }}>{c.d}</div>
      </div>
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%',
        border: `1.5px solid ${selected ? '#e52929' : 'var(--border-md)'}`,
        background: selected ? '#e52929' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.14s',
      }}>
        {selected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
      </div>
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage({ onGenerate, onBack, prefill }) {
  const [steps, setSteps]           = useState(BASE_STEPS)
  const [step, setStep]             = useState(prefill ? BASE_STEPS.length - 1 : 0)
  const [loading, setLoading]       = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [answers, setAnswers]       = useState(
    prefill ? { ...DEFAULT_ANSWERS, ...prefill } : DEFAULT_ANSWERS
  )

  useEffect(() => {
    if (prefill) {
      setAnswers({ ...DEFAULT_ANSWERS, ...prefill })
      setStep(BASE_STEPS.length - 1)
      if (prefill.topic) classifyAndUpdateTimeframes(prefill.topic)
    }
  }, [prefill])

  // After user types topic, classify it to get goal-specific timeframe options
  const classifyAndUpdateTimeframes = async (topic) => {
    setClassifying(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/generate-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: topic, timeframe: 'not selected yet', experience: 'beginner' }),
      })
      const data = await res.json()

      let newChoices = null
      if (data.timeframe_options?.length) {
        newChoices = data.timeframe_options.map(o => ({
          v: o.value ?? o.v,
          l: o.label ?? o.l,
          d: o.sublabel ?? o.d ?? '',
        }))
      } else if (data.goal_type) {
        newChoices = TIMEFRAME_DEFAULTS[data.goal_type] || TIMEFRAME_DEFAULTS.skill
      }

      if (newChoices) {
        setSteps(prev => prev.map(s => s.id === 'weeks' ? { ...s, choices: newChoices } : s))
        setAnswers(a => ({ ...a, weeks: '' }))
      }
    } catch {
      // silently fall back to defaults
    } finally {
      setClassifying(false)
    }
  }

  const cur    = steps[step]
  const val    = answers[cur.field]
  const canNext = cur.type === 'text'
    ? String(val).trim().length > 2
    : val !== '' && val !== undefined

  const handleNext = async () => {
    // Kick off background classify when leaving topic step
    if (cur.id === 'topic' && String(val).trim().length > 2) {
      classifyAndUpdateTimeframes(String(val).trim())
    }

    if (step < steps.length - 1) { setStep(s => s + 1); return }

    // Last step — generate
    setLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/generate-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: `${answers.topic} — goal type: ${answers.goal}, level: ${answers.level}, ${answers.hoursPerWeek} hrs/week`,
          timeframe: String(answers.weeks),
          experience: answers.level || 'beginner',
        }),
      })
      const data = await res.json()
      onGenerate({ ...data, userAnswers: answers })
    } catch {
      onGenerate(fallback(answers))
    } finally {
      setLoading(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
      <div style={{ width: '48px', height: '48px', border: '2px solid var(--s3)', borderTop: '2px solid var(--r4)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1.1rem', marginBottom: '6px' }}>Building your roadmap…</div>
        <div style={{ color: 'var(--ts)', fontSize: '0.85rem' }}>Our AI is mapping out your personalized journey</div>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 40px' }}>
      <Navbar onBack={onBack} showBack />

      {prefill && (
        <div style={{
          width: '100%', maxWidth: '500px',
          background: 'rgba(229,41,41,0.08)', border: '1px solid rgba(229,41,41,0.2)',
          borderRadius: '10px', padding: '10px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '0.8rem', color: 'var(--r3)',
        }}>
          <span style={{ fontSize: '14px' }}>✦</span>
          Pre-filled from an example — tweak anything you like before generating.
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '500px', animation: 'fadeUp 0.4s var(--ease)' }}>
        <Dots step={step} total={steps.length} />

        <div style={{ fontSize: '0.68rem', fontFamily: "'Syne',sans-serif", fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--tm)', textAlign: 'center', marginBottom: '10px' }}>
          Step {step + 1} of {steps.length}
        </div>
        <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', textAlign: 'center', marginBottom: '9px' }}>{cur.question}</h2>
        <p style={{ color: 'var(--ts)', textAlign: 'center', fontSize: '0.875rem', marginBottom: '30px', lineHeight: 1.6 }}>{cur.sub}</p>

        <div style={{ marginBottom: '28px' }}>
          {cur.type === 'text' && (
            <input
              autoFocus type="text" placeholder={cur.placeholder}
              value={answers[cur.field]}
              onChange={e => setAnswers(a => ({ ...a, [cur.field]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && canNext) handleNext() }}
              style={{ fontSize: '1rem', padding: '15px 18px' }}
            />
          )}

          {cur.type === 'choice' && (
            <>
              {classifying && cur.id === 'weeks' && (
                <div style={{ textAlign: 'center', color: 'var(--tm)', fontSize: '0.8rem', marginBottom: '14px' }}>
                  Analysing your goal… ✦
                </div>
              )}
              {cur.choices.map(c => (
                <Choice key={c.v} c={c} selected={answers[cur.field] === c.v} onSelect={v => setAnswers(a => ({ ...a, [cur.field]: v }))} />
              ))}
            </>
          )}

          {cur.type === 'slider' && (
            <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: '18px', padding: '28px 24px' }}>
              <div style={{ textAlign: 'center', fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '2.8rem', color: 'var(--r4)', letterSpacing: '-0.04em', marginBottom: '20px' }}>
                {answers[cur.field]}
                <span style={{ fontSize: '0.875rem', color: 'var(--ts)', fontWeight: 400, marginLeft: '6px' }}>{cur.unit}</span>
              </div>
              <input
                type="range" min={cur.min} max={cur.max} value={answers[cur.field]}
                onChange={e => setAnswers(a => ({ ...a, [cur.field]: Number(e.target.value) }))}
                style={{
                  width: '100%',
                  background: `linear-gradient(to right,var(--r4) 0%,var(--r4) ${((answers[cur.field] - cur.min) / (cur.max - cur.min)) * 100}%,var(--s3) ${((answers[cur.field] - cur.min) / (cur.max - cur.min)) * 100}%,var(--s3) 100%)`,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '9px', fontSize: '0.7rem', color: 'var(--tm)' }}>
                <span>{cur.min} hrs</span><span>{cur.max} hrs</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {step > 0 && (
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(s => s - 1)}>← Back</button>
          )}
          <button
            className="btn btn-primary"
            style={{ flex: 2, justifyContent: 'center', padding: '13px', opacity: canNext ? 1 : 0.4 }}
            onClick={handleNext}
            disabled={!canNext}
          >
            {step === steps.length - 1 ? 'Generate my roadmap →' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function fallback(a) {
  return {
    title: `${a.topic} Roadmap`,
    goal_type: 'skill',
    total_xp: 500,
    timeframe_options: TIMEFRAME_DEFAULTS.skill,
    userAnswers: a,
    nodes: [
      { id: 'node_1',  title: 'Foundation',      description: 'Core concepts and setup.',     duration_label: 'Week 1–2',  status: 'active', type: 'main',  xp_reward: 100, emoji: '🚀', resources: [{ label: 'Official Docs', url: '', tip: 'Start here' }] },
      { id: 'node_2',  title: 'Core Skills',     description: 'Key techniques and practice.', duration_label: 'Week 3–5',  status: 'locked', type: 'main',  xp_reward: 100, emoji: '🔧', resources: [] },
      { id: 'node_3',  title: 'Build something', description: "Apply what you've learned.",   duration_label: 'Week 6–9',  status: 'locked', type: 'main',  xp_reward: 150, emoji: '🏗️', resources: [] },
      { id: 'node_4',  title: 'Ship it',         description: 'Deploy and share your work.',  duration_label: 'Week 10+',  status: 'locked', type: 'main',  xp_reward: 150, emoji: '🚢', resources: [] },
      { id: 'bonus_1', title: 'Go deeper',       description: 'Challenge yourself further.',  duration_label: 'Anytime',   status: 'locked', type: 'bonus', xp_reward: 250, emoji: '⭐', resources: [] },
    ],
  }
}