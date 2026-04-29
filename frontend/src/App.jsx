import { useState } from 'react'
import LandingPage    from './pages/LandingPage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import RoadmapPage    from './pages/RoadmapPage.jsx'

export default function App() {
  const [page, setPage]           = useState('landing')
  const [roadmapData, setRoadmap] = useState(null)

  const handleGenerated = (data) => { setRoadmap(data); setPage('roadmap') }
  const handleBack      = ()     => { setPage('landing'); setRoadmap(null) }

  return (
    <>
      {page === 'landing'    && <LandingPage    onStart={() => setPage('onboarding')} />}
      {page === 'onboarding' && <OnboardingPage onGenerate={handleGenerated} onBack={() => setPage('landing')} />}
      {page === 'roadmap'    && roadmapData && <RoadmapPage data={roadmapData} onBack={handleBack} />}
    </>
  )
}