// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { getUserProfile, updateUserStreakOnLogin } from '../lib/firestore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still loading, null = confirmed signed out, object = signed in
  const [user,    setUser]    = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null) // Firestore user profile

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // User signed in — load profile and update streak
        try {
          const firebaseProfile = await getUserProfile(u.uid)
          const updatedStreak = await updateUserStreakOnLogin(u.uid, firebaseProfile)
          setProfile({ ...firebaseProfile, ...updatedStreak })
        } catch (error) {
          console.error('Error loading user profile:', error)
          setProfile(null)
        }
      } else {
        // User signed out
        setProfile(null)
      }
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  const logout = () => signOut(auth)

  // Optimistic update for auth UX — allows immediate UI update after Firebase call
  const optimisticSetUser = (firebaseUser) => {
    setUser(firebaseUser)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, profile, optimisticSetUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}