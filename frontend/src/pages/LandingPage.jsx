import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6">
        <span className="text-5xl">🗺️</span>
      </div>
      <h1 className="text-5xl font-bold text-white mb-4">
        Road<span className="text-blue-400">mapify</span>
      </h1>
      <p className="text-slate-400 text-lg max-w-xl mb-10">
        Tell us what you want to learn. We'll generate a personalized,
        step-by-step learning roadmap powered by AI — in seconds.
      </p>

      <button
        onClick={() => navigate('/generate')}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold
                   px-8 py-3 rounded-xl text-lg transition-all duration-200
                   shadow-lg"
      >
        Generate My Roadmap →
      </button>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        {[
          { icon: '🧠', title: 'AI-Powered', desc: 'Uses Groq LLaMA3 with RAG retrieval from curated learning resources.' },
          { icon: '🗂️', title: 'Structured Stages', desc: 'Your roadmap is broken into clear weekly stages with topics and resources.' },
          { icon: '⚡', title: 'Instant Results', desc: 'Get a full personalized learning plan in under 10 seconds.' },
        ].map(f => (
          <div key={f.title} className="bg-slate-800 rounded-2xl p-6 text-left border border-slate-700">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="text-white font-semibold mb-2">{f.title}</h3>
            <p className="text-slate-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}