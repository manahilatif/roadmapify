import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow'
import 'reactflow/dist/style.css'

function StageNode({ data }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{ minWidth: 220, maxWidth: 280, cursor: 'pointer' }}
      className="bg-slate-800 border border-slate-600 rounded-2xl p-4 hover:border-blue-500 transition-all shadow-xl"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          Stage {data.stage_number}
        </span>
        <span className="text-slate-400 text-xs">{data.duration_weeks}w</span>
      </div>
      <h3 className="text-white font-semibold text-sm mb-2">{data.title}</h3>
      {open && (
        <div className="mt-3 border-t border-slate-700 pt-3 space-y-3">
          {data.topics?.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs font-medium mb-1">Topics</p>
              <ul className="space-y-1">
                {data.topics.map((t, i) => (
                  <li key={i} className="text-slate-300 text-xs flex items-start gap-1">
                    <span className="text-blue-400 mt-0.5">•</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.resources?.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs font-medium mb-1">Resources</p>
              <ul className="space-y-1">
                {data.resources.map((r, i) => (
                  <li key={i} className="text-blue-400 text-xs flex items-start gap-1">
                    <span className="mt-0.5">🔗</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="text-slate-500 text-xs mt-2">{open ? 'Click to collapse' : 'Click to expand'}</p>
    </div>
  )
}

const nodeTypes = { stageNode: StageNode }

function buildGraph(stages) {
  const nodes = stages.map((stage, i) => ({
    id: `stage-${i}`,
    type: 'stageNode',
    position: { x: 0, y: i * 260 },
    data: {
      stage_number: stage.stage_number ?? i + 1,
      title: stage.title ?? `Stage ${i + 1}`,
      duration_weeks: stage.duration_weeks ?? 2,
      topics: stage.topics ?? [],
      resources: stage.resources ?? [],
    },
  }))
  const edges = stages.slice(0, -1).map((_, i) => ({
    id: `e-${i}`,
    source: `stage-${i}`,
    target: `stage-${i + 1}`,
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 },
  }))
  return { nodes, edges }
}

function parseRoadmap(data) {
  let raw = data?.roadmap ?? data
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw.replace(/```json|```/g, '').trim()) }
    catch { return { title: 'Your Roadmap', stages: [] } }
  }
  if (Array.isArray(raw)) return { title: 'Your Roadmap', stages: raw }
  if (raw?.stages && Array.isArray(raw.stages)) return { title: raw.title ?? 'Your Roadmap', stages: raw.stages }
  return { title: 'Your Roadmap', stages: [] }
}

export default function RoadmapPage() {
  const navigate = useNavigate()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [title, setTitle] = useState('Your Roadmap')
  const [error, setError] = useState('')

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  useEffect(() => {
    const raw = sessionStorage.getItem('roadmap')
    if (!raw) { setError('No roadmap found. Please generate one first.'); return }
    try {
      const { title: t, stages } = parseRoadmap(JSON.parse(raw))
      setTitle(t)
      if (!stages?.length) { setError('Roadmap returned no stages. Please try again.'); return }
      const { nodes: n, edges: e } = buildGraph(stages)
      setNodes(n)
      setEdges(e)
    } catch { setError('Failed to parse roadmap data.') }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/generate')} className="text-slate-400 hover:text-white text-sm">
            ← New Roadmap
          </button>
          <span className="text-slate-600">|</span>
          <h1 className="text-white font-semibold text-sm truncate max-w-xs">{title}</h1>
        </div>
        <span className="text-slate-500 text-xs">Click any node to expand</span>
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={() => navigate('/generate')} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm">
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <div style={{ height: 'calc(100vh - 65px)' }}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} nodeTypes={nodeTypes}
            fitView fitViewOptions={{ padding: 0.3 }}
          >
            <MiniMap nodeColor="#3b82f6" maskColor="rgba(15,23,42,0.8)"
              style={{ background: '#1e293b', border: '1px solid #334155' }} />
            <Controls style={{ background: '#1e293b', border: '1px solid #334155' }} />
            <Background color="#334155" gap={24} />
          </ReactFlow>
        </div>
      )}
    </div>
  )
}