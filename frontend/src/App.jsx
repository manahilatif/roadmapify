import { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import LandingPage    from './pages/LandingPage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import RoadmapPage    from './pages/RoadmapPage.jsx'

function AppRoutes() {
  const [roadmapData, setRoadmap] = useState(null)
  const navigate = useNavigate()

  const handleGenerated = (data) => { setRoadmap(data); navigate('/roadmap') }
  const handleBack      = ()     => { setRoadmap(null); navigate('/') }

  return (
    <Routes>
      <Route path="/"         element={<LandingPage    onStart={() => navigate('/onboarding')} />} />
      <Route path="/onboarding" element={<OnboardingPage onGenerate={handleGenerated} onBack={() => navigate('/')} />} />
      <Route path="/roadmap"  element={roadmapData ? <RoadmapPage data={roadmapData} onBack={handleBack} /> : null} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}