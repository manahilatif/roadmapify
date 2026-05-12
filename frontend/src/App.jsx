// src/App.jsx
import { useState, useEffect, useCallback } from 'react'
import LandingPage    from './pages/LandingPage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import RoadmapPage    from './pages/RoadmapPage.jsx'
import MyRoadmapsPage from './pages/MyRoadmapsPage.jsx'
import { AuthProvider, useAuth } from './context/AuthContext'
import { createUserRoadmap } from './services/roadmapsFirestore'

function AppContent() {
  const { user } = useAuth()
  const [page, setPage]            = useState('landing')
  const [roadmapData, setRoadmap]  = useState(null)
  const [savedRoadmapId, setSavedRoadmapId] = useState(null)
  const [roadmapMountKey, setRoadmapMountKey] = useState(0)
  const [prefill, setPrefill]      = useState(null)
  const [roadmapsRefreshKey, setRoadmapsRefreshKey] = useState(0)

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
      if (p !== 'roadmap') {
        setRoadmap(null)
        setSavedRoadmapId(null)
        setRoadmapMountKey((k) => k + 1)
      }
    }
    window.addEventListener('popstate', onPop)
    window.history.replaceState({ page: 'landing' }, '', '/')
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /**
   * Open the roadmap immediately, then save to Firestore when signed in (non-blocking).
   * Avoids the UI appearing stuck on onboarding if addDoc is slow or hangs. RoadmapPage
   * picks up savedRoadmapId when the write completes. firestoreSaved skips duplicate legacy saves.
   */
  const handleGenerated = (data, meta = {}) => {
    const enriched = {
      ...data,
      earnedXP: data.earnedXP ?? 0,
      streak: data.streak ?? 8,
      topic: meta.topic || data.topic || data.goal || '',
      firestoreSaved: true,
    }

    setPrefill(null)
    setSavedRoadmapId(null)
    setRoadmapMountKey((k) => k + 1)
    setRoadmap(enriched)
    navigate('roadmap')

<<<<<<< Updated upstream
    if (user?.uid) {
      createUserRoadmap(user.uid, {
        topic: enriched.topic || enriched.title || 'My roadmap',
        roadmapData: enriched,
=======
    // Only save to Firestore if the data has a valid title and nodes
    if (user?.uid && enriched.title && enriched.title.trim() && Array.isArray(enriched.nodes) && enriched.nodes.length > 0) {
      queueMicrotask(() => {
        createUserRoadmap(user.uid, {
          topic: enriched.topic || enriched.title || 'My roadmap',
          roadmapData: enriched,
        })
          .then((id) => setSavedRoadmapId(id))
          .catch((err) => console.error('Could not save roadmap to cloud:', err))
>>>>>>> Stashed changes
      })
        .then((docId) => setSavedRoadmapId(docId))
        .catch((err) => console.error('Could not save roadmap to cloud:', err))
    }
  }

  const handleBack = () => {
    setRoadmap(null)
    setSavedRoadmapId(null)
    setRoadmapMountKey((k) => k + 1)
    navigate('landing')
  }

  const handleStartWithExample = (answers) => {
    setPrefill(answers)
    navigate('onboarding')
  }

  const goMyRoadmaps = () => {
    setRoadmapsRefreshKey((k) => k + 1)
    navigate('my-roadmaps')
  }

  const handleOpenSavedRoadmap = (id, roadmapPayload) => {
    setRoadmapMountKey((k) => k + 1)
    setSavedRoadmapId(id)
    setRoadmap(roadmapPayload)
    navigate('roadmap')
  }

  /* Same roadmap object you got after Generate — stays updated when you complete nodes */
  const mergeRoadmapProgress = useCallback((snap) => {
    setRoadmap((prev) => {
      if (!prev) return snap
      return { ...prev, ...snap }
    })
  }, [])

  return (
    <>
      {page === 'landing' && (
        <LandingPage
          onStart={() => { setPrefill(null); navigate('onboarding') }}
          onStartWithExample={handleStartWithExample}
          onMyRoadmaps={goMyRoadmaps}
        />
      )}
      {page === 'onboarding' && (
        <OnboardingPage
          onGenerate={handleGenerated}
          onBack={() => navigate('landing')}
          prefill={prefill}
          onMyRoadmaps={goMyRoadmaps}
        />
      )}
      {page === 'my-roadmaps' && (
        <MyRoadmapsPage
          refreshKey={roadmapsRefreshKey}
          onBack={() => navigate('landing')}
          onOpenRoadmap={handleOpenSavedRoadmap}
        />
      )}
      {page === 'roadmap' && roadmapData && (
        <RoadmapPage
          key={roadmapMountKey}
          data={roadmapData}
          onBack={handleBack}
          savedRoadmapId={savedRoadmapId}
          onProgressChange={mergeRoadmapProgress}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
