// src/pages/OnboardingPage.jsx
import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar.jsx'
import { useAuth } from '../context/AuthContext'

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
    choices: TIMEFRAME_DEFAULTS.skill, 
  },
]

const DEFAULT_ANSWERS = { topic: '', level: '', goal: '', hoursPerWeek: 10, weeks: '' }

function isValidRoadmapPayload(data) {
  if (!data || typeof data !== 'object') return false
  const { nodes, modules, stages } = data
  return (Array.isArray(nodes) && nodes.length > 0)
    || (Array.isArray(modules) && modules.length > 0)
    || (Array.isArray(stages) && stages.length > 0)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Dots({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginBottom: '36px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: '5px', borderRadius: '3px', transition: 'all 0.3s',
          background: i < step ? '#dc2626' : i === step ? '#991b1b' : 'rgba(255,255,255,0.1)',
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
        background: selected ? 'rgba(220,38,38,0.09)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? '#dc2626' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '13px', padding: '15px 18px', cursor: 'pointer',
        textAlign: 'left', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', transition: 'all 0.14s',
        marginBottom: '8px',
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: selected ? '#dc2626' : '#fff', marginBottom: '2px' }}>{c.l}</div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{c.d}</div>
      </div>
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%',
        border: `1.5px solid ${selected ? '#dc2626' : 'rgba(255,255,255,0.2)'}`,
        background: selected ? '#dc2626' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
      </div>
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OnboardingPage({ onGenerate, onBack, prefill, onMyRoadmaps }) {
  const { user } = useAuth()
  const [steps, setSteps]           = useState(BASE_STEPS)
  const [step, setStep]             = useState(prefill ? BASE_STEPS.length - 1 : 0)
  const [loading, setLoading]       = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError]           = useState('')
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

  const classifyAndUpdateTimeframes = async (topic) => {
    setClassifying(true)
    try {
      // Small call to backend to classify the topic type
      const res = await fetch(`${import.meta.env.VITE_API_URL}/generate-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: topic, timeframe: 'check', level: 'beginner' }),
      })
      const data = await res.json()

      let newChoices = data.goal_type ? TIMEFRAME_DEFAULTS[data.goal_type] : TIMEFRAME_DEFAULTS.skill
      if (newChoices) {
        setSteps(prev => prev.map(s => s.id === 'weeks' ? { ...s, choices: newChoices } : s))
      }
    } catch {
      // Fallback silently
    } finally {
      setClassifying(false)
    }
  }

  const suggestTimeframe = async () => {
    if (!answers.topic) {
      setError('Please enter your goal first.')
      return
    }
    setError('')
    setSuggesting(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/suggest-timeframe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: answers.topic })
      })
      if (res.ok) {
        const data = await res.json()
        // Find the choice that matches or is closest to the suggestion
        const suggested = data.suggested_timeframe
        const cur = steps.find(s => s.id === 'weeks')
        if (cur) {
          // Try to find a matching choice, or just select the first reasonable one
          const matchChoice = cur.choices.find(c => c.l.includes(suggested.split('-')[0]) || c.l.includes(suggested.split('–')[0]))
          if (matchChoice) {
            setAnswers(a => ({ ...a, weeks: matchChoice.v }))
          }
        }
      }
    } catch (err) {
      console.error('Error suggesting timeframe:', err)
    } finally {
      setSuggesting(false)
    }
  }

  const cur    = steps[step]
  const val    = answers[cur.field]
  const canNext = cur.type === 'text'
    ? String(val).trim().length > 2
    : val !== '' && val !== undefined

  const handleNext = async () => {
    if (cur.id === 'topic' && String(val).trim().length > 2) {
      classifyAndUpdateTimeframes(String(val).trim())
    }

    if (step < steps.length - 1) { setStep(s => s + 1); return }

    // Final Submission
    setError('')
    setLoading(true)
    try {
      const baseUrl = import.meta.env.VITE_API_URL
      if (!baseUrl) {
        console.error('VITE_API_URL is not set')
        onGenerate(fallback(answers), { topic: answers.topic })
        return
      }
      const res = await fetch(`${baseUrl}/generate-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: answers.topic,
          domain: answers.goal || "general",
          level: answers.level || 'beginner',
          hours_per_week: answers.hoursPerWeek,
          learning_style: "mixed",
          context_extra: `Target completion: ${answers.weeks}`,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !isValidRoadmapPayload(data)) {
        if (!res.ok) console.error('Generate roadmap HTTP', res.status, data)
        onGenerate(fallback(answers), { topic: answers.topic })
      } else {
        onGenerate(data, { topic: answers.topic })
      }
    } catch (err) {
      console.error("Generation error:", err)
      onGenerate(fallback(answers), { topic: answers.topic })
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
      <div style={{ width: '48px', height: '48px', border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '6px' }}>Building your roadmap…</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Our AI is mapping out your personalized journey</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <Navbar onBack={onBack} showBack onMyRoadmaps={user ? onMyRoadmaps : undefined} />

      <div style={{ width: '100%', maxWidth: '500px' }}>
        <Dots step={step} total={steps.length} />

        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: '10px' }}>
          Step {step + 1} of {steps.length}
        </div>
        <h2 style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: '10px' }}>{cur.question}</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '32px' }}>{cur.sub}</p>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', 
            padding: '14px 16px', marginBottom: '24px', color: 'rgba(239,68,68,0.9)', fontSize: '0.9rem', lineHeight: '1.5'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠ Invalid goal</div>
            <div>{error}</div>
          </div>
        )}

        <div style={{ marginBottom: '32px' }}>
          {cur.type === 'text' && (
            <input
              autoFocus type="text" placeholder={cur.placeholder}
              value={answers[cur.field]}
              onChange={e => setAnswers(a => ({ ...a, [cur.field]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && canNext) handleNext() }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '15px', color: '#fff', fontSize: '1rem' }}
            />
          )}

          {cur.type === 'choice' && (
            <div>
              {cur.id === 'weeks' && (
                <button
                  onClick={suggestTimeframe}
                  disabled={suggesting || !answers.topic}
                  style={{
                    width: '100%', marginBottom: '12px', padding: '12px',
                    background: suggesting ? 'rgba(220,38,38,0.15)' : 'rgba(220,38,38,0.1)',
                    border: '1px solid rgba(220,38,38,0.2)',
                    color: suggesting ? 'rgba(220,38,38,0.8)' : 'rgba(220,38,38,0.7)',
                    borderRadius: '12px', cursor: suggesting ? 'wait' : 'pointer',
                    fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => !suggesting && (e.target.style.background = 'rgba(220,38,38,0.15)')}
                  onMouseLeave={(e) => !suggesting && (e.target.style.background = 'rgba(220,38,38,0.1)')}
                >
                  {suggesting ? '✓ Suggesting...' : '💡 Suggest for me'}
                </button>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {cur.choices.map(c => (
                  <Choice key={c.v} c={c} selected={answers[cur.field] === c.v} onSelect={v => setAnswers(a => ({ ...a, [cur.field]: v }))} />
                ))}
              </div>
            </div>
          )}

          {cur.type === 'slider' && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '24px' }}>
              <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '2.5rem', color: '#dc2626', marginBottom: '16px' }}>
                {answers[cur.field]} <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>{cur.unit}</span>
              </div>
              <input
                type="range" min={cur.min} max={cur.max} value={answers[cur.field]}
                onChange={e => setAnswers(a => ({ ...a, [cur.field]: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: '#dc2626' }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '12px', cursor: 'pointer' }}>Back</button>
          )}
          <button
            onClick={handleNext}
            disabled={!canNext}
            style={{ flex: 2, background: canNext ? '#dc2626' : 'rgba(220,38,38,0.2)', border: 'none', color: '#fff', padding: '14px', borderRadius: '12px', fontWeight: 600, cursor: canNext ? 'pointer' : 'not-allowed' }}
          >
            {step === steps.length - 1 ? 'Generate my roadmap →' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function fallback(a) {
  const g = a.topic || 'your goal'
  return {
    title: `${g} Roadmap`,
    description: 'A step-by-step learning path',
    total_xp: 700,
    nodes: [
      { id: 'node_1', title: `Research ${g}`, description: 'Understand the full scope and set a measurable target.', type: 'main', emoji: '🔍', duration_label: 'Week 1', xp_reward: 100, status: 'active', steps: [`Search "${g} beginner guide" and read 2–3 overviews`, 'Write down the skills you need to acquire', 'Set a measurable goal', 'Find a community or forum for this topic'], resources: [{ label: 'freeCodeCamp', url: 'https://www.freecodecamp.org', tip: 'Free comprehensive learning' }] },
      { id: 'node_2', title: 'Set up your environment', description: 'Get tools and accounts ready before diving in.', type: 'main', emoji: '⚙️', duration_label: 'Week 1–2', xp_reward: 100, status: 'locked', steps: ['Create required accounts', 'Install recommended tools', 'Bookmark key reference sites', 'Block 30 min daily in your calendar'], resources: [{ label: 'MDN Web Docs', url: 'https://developer.mozilla.org', tip: 'Official reference' }] },
      { id: 'node_3', title: 'First practice session', description: 'Do your first hands-on exercise.', type: 'main', emoji: '✏️', duration_label: 'Week 2–3', xp_reward: 100, status: 'locked', steps: ['Pick one beginner exercise', 'Work through it without help', 'Review mistakes', 'Repeat the next day'], resources: [{ label: 'Kaggle Learn', url: 'https://www.kaggle.com/learn', tip: 'Hands-on micro-courses' }] },
      { id: 'node_4', title: 'Drill your weak spots', description: 'Focus on the areas where you struggle most.', type: 'main', emoji: '🏋️', duration_label: 'Week 3–4', xp_reward: 110, status: 'locked', steps: ['List your 2 weakest areas', 'Find a focused resource for each', 'Spend 20 min/day on them for one week', 'Track improvement with a simple log'], resources: [] },
      { id: 'node_5', title: 'Mock test or mini-project', description: 'Simulate the real challenge under realistic conditions.', type: 'main', emoji: '🎯', duration_label: 'Week 4–5', xp_reward: 120, status: 'locked', steps: ['Find a practice test or project brief', 'Complete it timed', 'Score yourself honestly', 'List 3 improvements'], resources: [] },
      { id: 'node_6', title: 'Close remaining gaps', description: 'Fix what the mock test exposed.', type: 'main', emoji: '🔧', duration_label: 'Week 5–6', xp_reward: 120, status: 'locked', steps: ['Rank gaps by impact', 'Spend one session on each top gap', 'Re-do the weakest section'], resources: [] },
      { id: 'node_7', title: 'Final attempt', description: 'Submit the real thing and reflect.', type: 'main', emoji: '🏁', duration_label: 'Week 7–8', xp_reward: 150, status: 'locked', steps: ['Take the real exam or submit project', 'Record your outcome', 'Write what went well and what to improve'], resources: [] },
      { id: 'bonus_1', title: 'Advanced stretch challenge', description: 'Push 20% beyond your original goal.', type: 'bonus', emoji: '⭐', duration_label: 'Anytime', xp_reward: 250, status: 'locked', steps: ['Set a harder stretch goal', 'Find an advanced resource or mentor', 'Document and share your journey'], resources: [] },
    ],
  }
}