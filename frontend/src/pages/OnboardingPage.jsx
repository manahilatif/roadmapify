import { useState } from 'react'
import Navbar from '../components/Navbar.jsx'

const STEPS = [
  { id:'goal',    question:"What's your main goal?",          sub:'This helps us shape the kind of roadmap we build for you.',              type:'choice', field:'goal',         choices:[{v:'job',l:'Reach a goal',d:'e.g. bake a cake, run a 5K, pass an exam'},{v:'project',l:'Create something',d:'e.g. knit a sweater, build an app, write a song'},{v:'upskill',l:'Get better at this',d:'Improve a skill you already have'},{v:'explore',l:'Just exploring',d:"Curious and want to see what it's about"}] },
  { id:'topic',   question:"What do you want to do?",         sub:'Be specific — "bake sourdough bread" works better than just "cooking".', type:'text',   field:'topic',        placeholder:'e.g. bake a chocolate chip cookie, learn Spanish, crochet a beanie...' },
  { id:'level',   question:"What's your current level?",      sub:'We use this to skip what you already know.',                             type:'choice', field:'level',        choices:[{v:'beginner',l:'Beginner',d:'Just starting out'},{v:'intermediate',l:'Intermediate',d:'Some experience'},{v:'advanced',l:'Advanced',d:'Solid foundation'}] },
  { id:'hours',   question:"Hours per week you can commit?",  sub:"Be honest — we'd rather plan a realistic journey.",                      type:'slider', field:'hoursPerWeek', min:2, max:40, unit:'hrs/wk' },
  { id:'weeks',   question:"Target completion in…",           sub:'Pick a timeframe that feels ambitious but doable.',                      type:'choice', field:'weeks',        choices:[{v:4,l:'1 month',d:'Intense sprint'},{v:8,l:'2 months',d:'Steady pace'},{v:16,l:'4 months',d:'Comfortable'},{v:26,l:'6 months',d:'Deep mastery'}] },
]

function Dots({ step, total }) {
  return (
    <div style={{ display:'flex', gap:'5px', justifyContent:'center', marginBottom:'36px' }}>
      {Array.from({length:total}).map((_,i) => (
        <div key={i} style={{ height:'5px', borderRadius:'3px', transition:'all 0.3s', background: i<step?'var(--r6)':i===step?'var(--r4)':'var(--s3)', width: i===step?'22px':'5px' }}/>
      ))}
    </div>
  )
}

function Choice({ c, selected, onSelect }) {
  return (
    <button onClick={() => onSelect(c.v)} style={{ width:'100%', background:selected?'rgba(229,41,41,0.09)':'var(--s1)', border:`1px solid ${selected?'#e52929':'var(--border-md)'}`, borderRadius:'13px', padding:'15px 18px', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all 0.14s', boxShadow:selected?'0 0 0 1px #e52929':'none', marginBottom:'8px' }}
      onMouseEnter={e=>{ if(!selected) e.currentTarget.style.borderColor='var(--border-hi)' }}
      onMouseLeave={e=>{ if(!selected) e.currentTarget.style.borderColor='var(--border-md)' }}
    >
      <div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.9rem', color:selected?'var(--r3)':'var(--tp)', marginBottom:'2px' }}>{c.l}</div>
        <div style={{ fontSize:'0.78rem', color:'var(--ts)' }}>{c.d}</div>
      </div>
      <div style={{ width:'18px', height:'18px', borderRadius:'50%', border:`1.5px solid ${selected?'#e52929':'var(--border-md)'}`, background:selected?'#e52929':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.14s' }}>
        {selected && <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#fff' }}/>}
      </div>
    </button>
  )
}

export default function OnboardingPage({ onGenerate, onBack }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({ topic:'', level:'', goal:'', hoursPerWeek:10, weeks:8 })

  const cur = STEPS[step]
  const val = answers[cur.field]
  const canNext = cur.type==='text' ? String(val).trim().length>2 : val !== '' && val !== undefined

  const handleNext = async () => {
    if (step < STEPS.length - 1) { setStep(s=>s+1); return }
    setLoading(true)
    try {
      // Call your existing backend endpoint
      const res = await fetch('http://localhost:8000/generate-roadmap', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ goal: `Learn ${answers.topic} as a ${answers.level}. Goal: ${answers.goal}. ${answers.hoursPerWeek} hours/week for ${answers.weeks} weeks.` })
      })
      const data = await res.json()
      onGenerate({ ...data, userAnswers: answers })
    } catch {
      onGenerate(fallback(answers))
    } finally { setLoading(false) }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px' }}>
      <div style={{ width:'48px', height:'48px', border:'2px solid var(--s3)', borderTop:'2px solid var(--r4)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'1.1rem', marginBottom:'6px' }}>Building your roadmap…</div>
        <div style={{ color:'var(--ts)', fontSize:'0.85rem' }}>Our AI is mapping out your {answers.weeks}-week journey</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px 40px' }}>
      <Navbar onBack={onBack} showBack />
      <div style={{ width:'100%', maxWidth:'500px', animation:'fadeUp 0.4s var(--ease)' }}>
        <Dots step={step} total={STEPS.length} />
        <div style={{ fontSize:'0.68rem', fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:'0.09em', textTransform:'uppercase', color:'var(--tm)', textAlign:'center', marginBottom:'10px' }}>Step {step+1} of {STEPS.length}</div>
        <h2 style={{ fontSize:'clamp(1.5rem,3vw,2rem)', textAlign:'center', marginBottom:'9px' }}>{cur.question}</h2>
        <p style={{ color:'var(--ts)', textAlign:'center', fontSize:'0.875rem', marginBottom:'30px', lineHeight:1.6 }}>{cur.sub}</p>

        <div style={{ marginBottom:'28px' }}>
          {cur.type==='text' && (
            <input autoFocus type="text" placeholder={cur.placeholder} value={answers[cur.field]}
              onChange={e=>setAnswers(a=>({...a,[cur.field]:e.target.value}))}
              onKeyDown={e=>{ if(e.key==='Enter'&&canNext) handleNext() }}
              style={{ fontSize:'1rem', padding:'15px 18px' }}
            />
          )}
          {cur.type==='choice' && cur.choices.map(c => (
            <Choice key={c.v} c={c} selected={answers[cur.field]===c.v} onSelect={v=>setAnswers(a=>({...a,[cur.field]:v}))}/>
          ))}
          {cur.type==='slider' && (
            <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:'18px', padding:'28px 24px' }}>
              <div style={{ textAlign:'center', fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'2.8rem', color:'var(--r4)', letterSpacing:'-0.04em', marginBottom:'20px' }}>
                {answers[cur.field]}<span style={{ fontSize:'0.875rem', color:'var(--ts)', fontWeight:400, marginLeft:'6px' }}>{cur.unit}</span>
              </div>
              <input type="range" min={cur.min} max={cur.max} value={answers[cur.field]}
                onChange={e=>setAnswers(a=>({...a,[cur.field]:Number(e.target.value)}))}
                style={{ width:'100%', background:`linear-gradient(to right,var(--r4) 0%,var(--r4) ${((answers[cur.field]-cur.min)/(cur.max-cur.min))*100}%,var(--s3) ${((answers[cur.field]-cur.min)/(cur.max-cur.min))*100}%,var(--s3) 100%)` }}
              />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'9px', fontSize:'0.7rem', color:'var(--tm)' }}>
                <span>{cur.min} hrs</span><span>{cur.max} hrs</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:'10px' }}>
          {step>0 && <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setStep(s=>s-1)}>← Back</button>}
          <button className="btn btn-primary" style={{ flex:2, justifyContent:'center', padding:'13px', opacity:canNext?1:0.4 }} onClick={handleNext} disabled={!canNext}>
            {step===STEPS.length-1 ? 'Generate my roadmap →' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function fallback(a) {
  return {
    title:`${a.topic} Roadmap`,
    description:`A ${a.weeks}-week personalized learning journey`,
    userAnswers: a,
    stages:[
      { id:'s1', title:'Foundation',      topics:['Core concepts','Setup & tools'],   week_start:1,  week_end:2,  resources:['Official Docs','freeCodeCamp'],     type:'main'  },
      { id:'s2', title:'Core Skills',     topics:['Key techniques','Practice'],        week_start:3,  week_end:5,  resources:['YouTube Tutorial','MDN'],            type:'main'  },
      { id:'s3', title:'Deep Dive',       topics:['Advanced theory'],                  week_start:3,  week_end:4,  resources:['CS50','MIT OCW'],                    type:'bonus' },
      { id:'s4', title:'Projects',        topics:['Build something real'],             week_start:6,  week_end:9,  resources:['Frontend Mentor','Exercism'],        type:'main'  },
      { id:'s5', title:'Advanced Topics', topics:['Edge cases','Optimization'],        week_start:10, week_end:13, resources:['Official Docs','Egghead.io'],         type:'main'  },
      { id:'s6', title:'Ship It',         topics:['Deploy','Portfolio'],               week_start:14, week_end:a.weeks, resources:['Vercel','GitHub Pages'],        type:'main'  },
    ]
  }
}