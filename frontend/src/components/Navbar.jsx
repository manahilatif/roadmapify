import { useNavigate } from 'react-router-dom'
import Logo from './Logo.jsx'

export default function Navbar({ onStart, onBack, showBack = false }) {
  const navigate = useNavigate()

  return (
    <nav style={{
      position: 'fixed', top:0, left:0, right:0, zIndex:100,
      height: '60px', padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(10,10,10,0.88)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ cursor:'pointer' }} onClick={() => navigate('/')}>
        <Logo size="md" />
      </div>
      <div style={{ display:'flex', gap:'10px' }}>
        {showBack
          ? <button className="btn btn-ghost btn-sm" onClick={onBack}>← Home</button>
          : <>
              <button className="btn btn-ghost btn-sm">Sign in</button>
              <button className="btn btn-primary btn-sm" onClick={onStart}>Get started</button>
            </>
        }
      </div>
    </nav>
  )
}