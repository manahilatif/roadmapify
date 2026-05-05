// src/App.jsx
import { useState, useEffect } from 'react'
import LandingPage    from './pages/LandingPage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import RoadmapPage    from './pages/RoadmapPage.jsx'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  const [page,        setPage]        = useState('landing')
  const [roadmapData, setRoadmap]     = useState(null)
  // Pre-filled answers when user clicks an example card
  const [prefill,     setPrefill]     = useState(null)

  const navigate = (newPage) => {
    window.history.pushState(
      { page: newPage },
      '',
      '/' + (newPage === 'landing' ? '' : newPage)
    )
    setPage(newPage)
  }

  useEffect(() => {
    const onPop = (e) => {
      const p = e.state?.page || 'landing'
      setPage(p)
      if (p !== 'roadmap') setRoadmap(null)
    }
    window.addEventListener('popstate', onPop)
    // Replace the initial history entry so back from landing works
    window.history.replaceState({ page: 'landing' }, '', '/')
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const handleGenerated = (data) => {
    setPrefill(null)      // clear prefill after generation
    setRoadmap(data)
    navigate('roadmap')
  }

  const handleBack = () => {
    setRoadmap(null)
    navigate('landing')
  }

  // "See examples" card clicked — pre-fill onboarding and jump straight to it
  const handleStartWithExample = (answers) => {
    setPrefill(answers)
    navigate('onboarding')
  }

  return (
    <AuthProvider>
      {page === 'landing' && (
        <LandingPage
          onStart={() => { setPrefill(null); navigate('onboarding') }}
          onStartWithExample={handleStartWithExample}
        />
      )}
      {page === 'onboarding' && (
        <OnboardingPage
          onGenerate={handleGenerated}
          onBack={() => navigate('landing')}
          prefill={prefill}
        />
      )}
      {page === 'roadmap' && roadmapData && (
        <RoadmapPage data={roadmapData} onBack={handleBack} />
      )}
    </AuthProvider>
  )
}