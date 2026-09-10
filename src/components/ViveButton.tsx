import { useState } from 'react'
import { Link } from '@tanstack/react-router'

/**
 * ViveButton — Floating Command Center Button
 * Standalone version (BottomNav also includes this; this is used elsewhere if needed)
 */
export default function ViveButton() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const actions = [
    { label: 'AI Chat', icon: '💬', to: '/chat' },
    { label: 'Scan Food', icon: '📷', to: '/scan' },
    { label: 'Journal', icon: '✎', to: '/journal' },
  ]

  return (
    <>
      {/* Overlay */}
      {isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99997,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          }}
        />
      )}

      {/* Action Menu */}
      {isMenuOpen && (
        <div
          style={{
            position: 'fixed', bottom: 180, left: '50%',
            transform: 'translateX(-50%)', zIndex: 99999,
            display: 'flex', flexDirection: 'column', gap: 10,
            alignItems: 'center',
          }}
        >
          {actions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              onClick={() => setIsMenuOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 24px', minWidth: 200,
                background: 'rgba(14,14,18,0.95)',
                border: '1px solid rgba(196,164,108,0.25)',
                borderRadius: 12, color: '#E8E0D8',
                fontSize: 13, fontWeight: 600,
                fontFamily: 'Inter, system-ui, sans-serif',
                textDecoration: 'none',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <span style={{ fontSize: 18 }}>{a.icon}</span>
              <span>{a.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Trigger Button */}
      <button
        onClick={() => setIsMenuOpen((v) => !v)}
        style={{
          position: 'fixed', bottom: 100, right: 24, zIndex: 99998,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(196,164,108,0.9), rgba(232,151,108,0.9))',
          border: '2px solid rgba(196,164,108,0.4)',
          color: '#0A0908', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800,
          boxShadow: '0 0 32px rgba(196,164,108,0.4), 0 4px 16px rgba(0,0,0,0.4)',
          transform: isMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}
        aria-label="Vive Command Center"
      >
        {isMenuOpen ? '×' : 'V'}
      </button>
    </>
  )
}
