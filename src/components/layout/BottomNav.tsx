import type { CSSProperties } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import type { ViewId } from './ViewManager'

/** Route fallbacks when BottomNav is used outside ViewManager */
const NAV_ITEMS: { view: ViewId; to: string; label: string; icon: string }[] = [
  { view: 'dashboard', to: '/', label: 'Home', icon: '⌂' },
  { view: 'journal', to: '/', label: 'Log', icon: '✎' },
  { view: 'biovault', to: '/biovault', label: 'Vault', icon: '◎' },
  { view: 'vitals', to: '/', label: 'Vitals', icon: '♡' },
]

export type BottomNavProps = {
  activeView?: ViewId
  onNavigate?: (view: ViewId) => void
  onViveTap?: () => void
  onViveDoubleTap?: () => void
  onViveLongPress?: () => void
  onViveLongPressEnd?: () => void
  isVoiceActive?: boolean
}

export const BottomNav = function BottomNav({
  activeView,
  onNavigate,
  onViveTap,
}: BottomNavProps = {}) {
  const location = useLocation()
  const currentPath = location.pathname
  const useViewNav = typeof onNavigate === 'function'

  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const active = useViewNav
      ? activeView === item.view
      : currentPath === item.to && item.view === 'dashboard'
        ? true
        : !useViewNav && item.to !== '/' && currentPath === item.to

    const style: CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      flex: 1,
      textDecoration: 'none',
      color: active ? '#C4A46C' : 'rgba(232,224,216,0.45)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.08em',
      fontFamily: 'Inter, system-ui, sans-serif',
      transition: 'color 0.2s',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
    }

    if (useViewNav) {
      return (
        <button
          key={item.view}
          type="button"
          onClick={() => onNavigate!(item.view)}
          style={style}
          aria-current={active ? 'page' : undefined}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
          <span style={{ textTransform: 'uppercase' }}>{item.label}</span>
        </button>
      )
    }

    return (
      <Link key={item.view} to={item.to} style={style}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
        <span style={{ textTransform: 'uppercase' }}>{item.label}</span>
      </Link>
    )
  }

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100000,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        pointerEvents: 'auto',
        background: 'rgba(10,9,8,0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)',
        paddingTop: 12,
        paddingLeft: 8,
        paddingRight: 8,
        height: 90,
      }}
    >
      {NAV_ITEMS.slice(0, 2).map(renderItem)}

      <button
        onClick={() => onViveTap?.()}
        style={{
          zIndex: 100001,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(196,164,108,0.9), rgba(232,151,108,0.9))',
          border: '2px solid rgba(196,164,108,0.4)',
          color: '#0A0908',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: '0.1em',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: '0 0 32px rgba(196,164,108,0.4), 0 4px 16px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
          marginTop: -20,
        }}
        aria-label="Open Vive AI Portal"
      >
        V
      </button>

      {NAV_ITEMS.slice(2).map(renderItem)}
    </nav>
  )
}

export default BottomNav
