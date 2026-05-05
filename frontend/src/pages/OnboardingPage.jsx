import { useState } from 'react'
import Navbar from '../components/Navbar.jsx'

const STEPS = 5

// Timeframe fallbacks per goal type (used before/if API classify fails)
const TIMEFRAME_DEFAULTS = {
  one_time: [
    { label: '30 min', sublabel: 'Quick session', value: '30_min' },
    { label: '1–2 hours', sublabel: 'Focused block', value: '1_2_hours' },
    { label: 'Half a day', sublabel: 'Morning project', value: 'half_day' },
    { label: 'Full day', sublabel: 'Deep immersion', value: 'full_day' },
  ],
  skill: [
    { label: '2 weeks', sublabel: 'Intense sprint', value: '2_weeks' },
    { label: '1 month', sublabel: 'Steady pace', value: '1_month' },
    { label: '3 months', sublabel: 'Comfortable', value: '3_months' },
    { label: '6 months', sublabel: 'Deep mastery', value: '6_months' },
  ],
  project: [
    { label: '1 week', sublabel: 'Hackathon mode', value: '1_week' },
    { label: '2 weeks', sublabel: 'Sprint', value: '2_weeks' },
    { label: '1 month', sublabel: 'Steady build', value: '1_month' },
    { label: '3 months', sublabel: 'Polish & launch', value: '3_months' },
  ],
  habit: [
    { label: '1 week', sublabel: 'Try it out', value: '1_week' },
    { label: '2 weeks', sublabel: 'Build the streak', value: '2_weeks' },
    { label: '1 month', sublabel: 'Lock it in', value: '1_month' },
    { label: '3 months', sublabel: 'Lifestyle change', value: '3_months' },
  ],
}

// Goal-type examples shown in step 1
const GOAL_EXAMPLES = [
  { emoji: '🍞', text: 'Bake sourdough bread' },
  { emoji: '🎨', text: 'Learn UI/UX design with Figma' },
  { emoji: '🏃', text: 'Run every morning' },
  { emoji: '📱', text: 'Build a mobile app' },
  { emoji: '🗣️', text: 'Speak conversational Spanish' },
  { emoji: '🎸', text: 'Play my first guitar chord' },
]

const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Complete beginner', sublabel: 'Starting from zero', emoji: '🌱' },
  { value: 'some', label: 'Some experience', sublabel: 'I know the basics', emoji: '🌿' },
  { value: 'intermediate', label: 'Intermediate', sublabel: 'Comfortable but want more', emoji: '🌳' },
  { value: 'advanced', label: 'Advanced', sublabel: 'I want to level up', emoji: '🚀' },
]

const HOURS_OPTIONS = [
  { value: '1-2', label: '1–2 hrs / day', sublabel: 'Casual' },
  { value: '3-4', label: '3–4 hrs / day', sublabel: 'Focused' },
  { value: '5-6', label: '5–6 hrs / day', sublabel: 'Intensive' },
  { value: '8+', label: '8+ hrs / day', sublabel: 'Full-time' },
]

export default function OnboardingPage({ onGenerate, onBack }) {
  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState('')
  const [experience, setExperience] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const [goalType, setGoalType] = useState('skill') // detected after step 1
  const [timeframeOptions, setTimeframeOptions] = useState(TIMEFRAME_DEFAULTS.skill)
  const [classifying, setClassifying] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  // After goal is typed and user clicks Next from step 1,
  // do a quick classify call to get the right timeframe options
  const handleGoalNext = async () => {
    if (!goal.trim()) return
    setStep(2)
    setClassifying(true)

    try {
      // We send just the goal to generate-roadmap with no timeframe yet.
      // The response includes goal_type + timeframe_options we can use.
      const res = await fetch(`${API}/generate-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim(), timeframe: 'not selected yet', experience: 'beginner' }),
      })
      const data = await res.json()
      if (data.goal_type && data.timeframe_options) {
        setGoalType(data.goal_type)
        setTimeframeOptions(data.timeframe_options)
      } else {
        setTimeframeOptions(TIMEFRAME_DEFAULTS[data.goal_type] || TIMEFRAME_DEFAULTS.skill)
      }
    } catch {
      // Silently fall back to defaults — no error shown to user
    } finally {
      setClassifying(false)
    }
  }

  const handleGenerate = async () => {
    if (!timeframe) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch(`${API}/generate-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goal.trim(),
          timeframe,
          experience,
        }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      onGenerate(data)
    } catch {
      setError('Something went wrong. Please try again.')
      setGenerating(false)
    }
  }

  const canNext = () => {
    if (step === 1) return goal.trim().length > 3
    if (step === 2) return !!experience
    if (step === 3) return !!hoursPerDay
    if (step === 4) return true
    if (step === 5) return !!timeframe
    return false
  }

  const progressPercent = ((step - 1) / (STEPS - 1)) * 100

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
      <Navbar onBack={onBack} showBack />

      {/* Progress bar */}
      <div style={{ position: 'fixed', top: 60, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.08)', zIndex: 50 }}>
        <div style={{
          height: '100%', background: 'var(--accent)',
          width: `${progressPercent}%`,
          transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 0 12px var(--accent)',
        }} />
      </div>

      <div style={{
        maxWidth: 560, margin: '0 auto', padding: '100px 24px 80px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* Step counter dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} style={{
              width: i === step - 1 ? 24 : 8,
              height: 8, borderRadius: 4,
              background: i < step ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
          Step {step} of {STEPS}
        </p>

        {/* ── STEP 1 — Goal ── */}
        {step === 1 && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(28px,5vw,40px)', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 12 }}>
              What's your goal?
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.6 }}>
              Be specific — the more detail you give, the better your roadmap.
            </p>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. bake sourdough bread, learn Figma, run a 5K..."
              rows={3}
              style={{
                width: '100%', padding: '16px 20px',
                background: 'rgba(255,255,255,0.05)',
                border: goal.length > 3 ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, color: 'var(--text)', fontSize: 16,
                fontFamily: 'var(--font-body)', resize: 'none', outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && canNext()) { e.preventDefault(); handleGoalNext() } }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, justifyContent: 'center' }}>
              {GOAL_EXAMPLES.map(ex => (
                <button key={ex.text} onClick={() => setGoal(ex.text)} style={{
                  padding: '6px 14px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                  {ex.emoji} {ex.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2 — Experience ── */}
        {step === 2 && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(26px,5vw,36px)', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 12 }}>
              Your experience level?
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Be honest — we'll calibrate the difficulty.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {EXPERIENCE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setExperience(opt.value)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                  background: experience === opt.value ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)',
                  border: experience === opt.value ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text)', transition: 'all 0.2s',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                    <span>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{opt.label}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{opt.sublabel}</div>
                    </span>
                  </span>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: experience === opt.value ? '5px solid var(--accent)' : '2px solid rgba(255,255,255,0.25)',
                    transition: 'all 0.15s',
                  }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3 — Hours/day ── */}
        {step === 3 && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(26px,5vw,36px)', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 12 }}>
              How much time per day?
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>This helps us pace each node realistically.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {HOURS_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setHoursPerDay(opt.value)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderRadius: 12, cursor: 'pointer',
                  background: hoursPerDay === opt.value ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)',
                  border: hoursPerDay === opt.value ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text)', transition: 'all 0.2s',
                }}>
                  <span>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{opt.label}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{opt.sublabel}</div>
                  </span>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: hoursPerDay === opt.value ? '5px solid var(--accent)' : '2px solid rgba(255,255,255,0.25)',
                    transition: 'all 0.15s',
                  }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 4 — Motivation (fun step) ── */}
        {step === 4 && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔥</div>
            <h1 style={{ fontSize: 'clamp(26px,5vw,36px)', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 16 }}>
              You're almost there.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, maxWidth: 420, margin: '0 auto 24px' }}>
              Your personalized roadmap will have <strong style={{ color: 'var(--text)' }}>micro-task nodes</strong> specific to your goal,
              XP rewards for every checkpoint, streaks to keep you going, and a surprise bonus level at the end.
            </p>
            <div style={{
              display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
              padding: '16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {['🎯 Goal-specific nodes', '⚡ XP rewards', '🔥 Daily streaks', '⭐ Bonus levels'].map(tag => (
                <span key={tag} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 13,
                  background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)',
                  color: 'rgba(255,255,255,0.8)',
                }}>{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 5 — Timeframe (DYNAMIC) ── */}
        {step === 5 && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(26px,5vw,36px)', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 12 }}>
              Target completion in...
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Pick a timeframe that feels ambitious but doable.</p>

            {classifying ? (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, padding: '24px 0' }}>
                Analysing your goal... ✨
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {timeframeOptions.map(opt => (
                  <button key={opt.value} onClick={() => setTimeframe(opt.value)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', borderRadius: 12, cursor: 'pointer',
                    background: timeframe === opt.value ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)',
                    border: timeframe === opt.value ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text)', transition: 'all 0.2s',
                  }}>
                    <span>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{opt.label}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{opt.sublabel}</div>
                    </span>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: timeframe === opt.value ? '5px solid var(--accent)' : '2px solid rgba(255,255,255,0.25)',
                      transition: 'all 0.15s',
                    }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && <p style={{ color: '#f87171', marginTop: 16, fontSize: 14 }}>{error}</p>}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, marginTop: 40, width: '100%' }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              flex: 1, padding: '14px 0', borderRadius: 12,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)', fontSize: 15, cursor: 'pointer',
            }}>
              ← Back
            </button>
          )}
          {step < STEPS ? (
            <button
              onClick={step === 1 ? handleGoalNext : () => setStep(s => s + 1)}
              disabled={!canNext()}
              style={{
                flex: 2, padding: '14px 0', borderRadius: 12,
                background: canNext() ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                border: 'none', color: canNext() ? '#fff' : 'rgba(255,255,255,0.3)',
                fontSize: 15, fontWeight: 600, cursor: canNext() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!canNext() || generating}
              style={{
                flex: 2, padding: '14px 0', borderRadius: 12,
                background: canNext() && !generating ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                border: 'none', color: canNext() && !generating ? '#fff' : 'rgba(255,255,255,0.3)',
                fontSize: 15, fontWeight: 600, cursor: canNext() && !generating ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              {generating ? 'Building your roadmap... ✨' : 'Generate my roadmap →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
} 