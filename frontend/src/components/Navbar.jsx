// src/components/Navbar.jsx
import { useState } from 'react'
import Logo from './Logo.jsx'
import SignInModal from './SignInModal.jsx'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ onStart, onBack, showBack = false, onMyRoadmaps }) {
  const { user, logout } = useAuth()
  const [showModal,    setShowModal]    = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Build initials from displayName or first char of email
  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?'

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: '60px', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(10,10,10,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ cursor: showBack ? 'pointer' : 'default' }} onClick={showBack ? onBack : undefined}>
          <Logo size="md" />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {showBack ? (
            <button className="btn btn-ghost btn-sm" onClick={onBack}>← Home</button>
          ) : user ? (
            /* ── Signed-in: avatar + dropdown ── */
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDropdown(d => !d)}
                style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: 'rgba(229,41,41,0.18)',
                  border: '1.5px solid rgba(229,41,41,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--r3)',
                  fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '0.75rem',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(229,41,41,0.6)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(229,41,41,0.35)'}
              >
                {initials}
              </button>

              {showDropdown && (
                <>
                  {/* invisible backdrop to capture outside clicks */}
                  <div
                    onClick={() => setShowDropdown(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  />
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    background: 'var(--s1)', border: '1px solid var(--border-md)',
                    borderRadius: '12px', padding: '6px', minWidth: '180px',
                    zIndex: 100, animation: 'fadeUp 0.15s var(--ease)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}>
                    <div style={{ padding: '8px 12px', marginBottom: '4px' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--tp)', fontFamily: "'Syne', sans-serif" }}>
                        {user.displayName || 'Learner'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--tm)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '156px' }}>
                        {user.email}
                      </div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0 6px' }} />
                    {onMyRoadmaps && (
                      <button
                        onClick={() => { onMyRoadmaps(); setShowDropdown(false) }}
                        style={{
                          width: '100%', background: 'transparent', border: 'none',
                          padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                          textAlign: 'left', fontSize: '0.8125rem', color: 'var(--ts)',
                          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '7px',
                          transition: 'background 0.12s, color 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.color = 'var(--tp)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ts)' }}
                      >
                        <span style={{ fontSize: '13px' }}>�️</span> My roadmaps
                      </button>
                    )}
                    <button
                      onClick={() => { logout(); setShowDropdown(false) }}
                      style={{
                        width: '100%', background: 'transparent', border: 'none',
                        padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                        textAlign: 'left', fontSize: '0.8125rem', color: 'var(--ts)',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '7px',
                        transition: 'background 0.12s, color 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.color = 'var(--tp)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ts)' }}
                    >
                      <span style={{ fontSize: '13px' }}>→</span> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ── Signed-out: sign in + get started ── */
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(true)}>Sign in</button>
              <button className="btn btn-primary btn-sm" onClick={onStart}>Get started</button>
            </>
          )}
        </div>
      </nav>

      {showModal && <SignInModal onClose={() => setShowModal(false)} />}
    </>
  )
}