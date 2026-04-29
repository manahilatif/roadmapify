export default function Logo({ size = 'md', showText = true }) {
  const s = { sm: [24,'1rem'], md: [30,'1.2rem'], lg: [42,'1.65rem'], xl: [60,'2.4rem'] }[size]
  return (
    <div style={{ display:'flex', alignItems:'center', gap: showText ? '4px' : 0 }}>
      <svg width={s[0]} height={s[0]} viewBox="0 0 64 64" fill="none" style={{ flexShrink:0 }}>
        <rect width="64" height="64" rx="14" fill="#e52929"/>
        <path d="M20 14 H34 a10 10 0 0 1 0 20 H26 l14 18"
          stroke="#fff" strokeWidth="6"
          strokeLinecap="square" strokeLinejoin="miter" fill="none"/>
      </svg>
      {showText && (
        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:s[1], letterSpacing:'-0.03em', color:'var(--tp)' }}>
          oad<span style={{ color:'#e52929' }}>mapify</span>
        </span>
      )}
    </div>
  )
}