// src/components/SignInModal.jsx
import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { getUserProfile } from '../lib/firestore'

const friendlyError = (code) => {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':  return 'Incorrect email or password.'
    case 'auth/email-already-in-use': return 'An account with this email already exists.'
    case 'auth/weak-password':        return 'Password must be at least 6 characters.'
    case 'auth/invalid-email':        return 'Please enter a valid email address.'
    case 'auth/too-many-requests':    return 'Too many attempts. Try again in a moment.'
    default:                          return 'Something went wrong. Please try again.'
  }
}

export default function SignInModal({ onClose }) {
  const { optimisticSetUser } = useAuth()
  const [mode,    setMode]    = useState('signin') // 'signin' | 'signup'
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [pw,      setPw]      = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!email.trim() || !pw.trim()) { setError('Please fill in all fields.'); return }
    if (mode === 'signup' && !name.trim()) { setError('Please enter your name.'); return }
    setLoading(true)
    try {
      let firebaseUser
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw)
        await updateProfile(cred.user, { displayName: name.trim() })
        firebaseUser = cred.user
        // Create Firestore profile immediately after sign-up
        try {
          await getUserProfile(firebaseUser.uid)
        } catch (err) {
          console.error('Error creating Firestore profile:', err)
          // Non-blocking — still allow user to proceed
        }
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), pw)
        firebaseUser = cred.user
      }
      
      // Optimistic update — show UI immediately without waiting for onAuthStateChanged
      optimisticSetUser(firebaseUser)
      onClose()
    } catch (e) {
      setError(friendlyError(e.code))
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }
  const switchMode = (m) => { setMode(m); setError(''); setName(''); setEmail(''); setPw('') }

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div style={{
        width: '100%', maxWidth: '400px',
        background: 'var(--s0)',
        border: '1px solid var(--border-md)',
        borderRadius: '20px',
        padding: '32px 28px',
        animation: 'fadeUp 0.22s var(--ease)',
        position: 'relative',
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'var(--s2)', border: '1px solid var(--border)',
          borderRadius: '8px', width: '30px', height: '30px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--ts)', fontSize: '16px', lineHeight: 1,
        }}>×</button>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.35rem', marginBottom: '6px' }}>
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--ts)' }}>
            {mode === 'signin'
              ? 'Sign in to save your progress and roadmaps.'
              : 'Free forever. No credit card needed.'}
          </div>
        </div>

        {/* Mode toggle pill */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          background: 'var(--s1)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '3px', marginBottom: '20px',
        }}>
          {['signin', 'signup'].map(m => (
            <button key={m} onClick={() => switchMode(m)} style={{
              padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.8rem',
              background: mode === m ? 'var(--s3)' : 'transparent',
              color: mode === m ? 'var(--tp)' : 'var(--tm)',
              transition: 'all 0.15s',
            }}>
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKey}
            autoFocus={mode === 'signin'}
          />
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={handleKey}
          />
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(229,41,41,0.1)', border: '1px solid rgba(229,41,41,0.25)',
            borderRadius: '8px', padding: '9px 12px',
            fontSize: '0.8rem', color: '#f87171', marginBottom: '14px',
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: '13px', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '14px', height: '14px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid #fff',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
                display: 'inline-block',
              }} />
              {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
            </span>
          ) : mode === 'signin' ? 'Sign in →' : 'Create account →'}
        </button>

        {/* Switch mode link */}
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--tm)' }}>
          {mode === 'signin' ? (
            <>No account?{' '}
              <button onClick={() => switchMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--r3)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit', padding: 0 }}>
                Sign up free
              </button>
            </>
          ) : (
            <>Already have one?{' '}
              <button onClick={() => switchMode('signin')} style={{ background: 'none', border: 'none', color: 'var(--r3)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit', padding: 0 }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}