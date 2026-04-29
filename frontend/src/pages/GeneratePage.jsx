import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced']
const TIME_OPTIONS = ['1 month', '3 months', '6 months', '1 year']

export default function GeneratePage() {
  const navigate = useNavigate()
  const [goal, setGoal] = useState('')
  const [difficulty, setDifficulty] = useState('Beginner')
  const [timeCommitment, setTimeCommitment] = useState('3 months')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!goal.trim()) {
      setError('Please enter a learning goal.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/generate-roadmap`,
        {
          goal: goal.trim(),
          difficulty: difficulty.toLowerCase(),
          time_commitment: timeCommitment,
        }
      )
      sessionStorage.setItem('roadmap', JSON.stringify(res.data))
      navigate('/roadmap')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white mb-6 flex items-center gap-2 text-sm transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-3xl font-bold text-white mb-2">What do you want to learn?</h2>
        <p className="text-slate-400 mb-8">Be as specific or broad as you like.</p>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 space-y-5">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Learning Goal
            </label>
            <textarea
              rows={3}
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. I want to become a backend developer using Python and Django"
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3
                         text-white placeholder-slate-500 resize-none focus:outline-none
                         focus:border-blue-500 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Current Level
            </label>
            <div className="flex gap-3">
              {DIFFICULTIES.map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    difficulty === d
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Time Available
            </label>
            <select
              value={timeCommitment}
              onChange={e => setTimeCommitment(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3
                         text-white focus:outline-none focus:border-blue-500 transition-colors text-sm"
            >
              {TIME_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                       disabled:cursor-not-allowed text-white font-semibold py-3
                       rounded-xl transition-all text-sm"
          >
            {loading ? '⏳ Generating your roadmap...' : 'Generate Roadmap →'}
          </button>
        </div>
      </div>
    </div>
  )
}