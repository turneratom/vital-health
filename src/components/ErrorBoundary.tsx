import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Clinical Error Boundary — wraps Intelligence components.
 * Shows 'ANALYZING...' state instead of crashing the view.
 */
export class ClinicalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ClinicalErrorBoundary] ${this.props.fallbackLabel ?? 'Component'} crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const label = this.props.fallbackLabel ?? 'MODULE';
      return (
        <div
          className="flex flex-col items-center justify-center py-12 px-4 rounded-xl mx-4 my-2"
          style={{
            background: 'rgba(10,10,10,0.6)',
            border: '1px solid rgba(255,59,48,0.12)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
            style={{
              background: 'rgba(255,59,48,0.08)',
              border: '1.5px solid rgba(255,59,48,0.2)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span
            className="text-[11px] font-mono uppercase tracking-[0.2em] mb-1"
            style={{ color: 'rgba(255,59,48,0.7)' }}
          >
            {label}_RECALIBRATING
          </span>
          <span
            className="text-[10px] font-mono"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Module will auto-recover on next data sync
          </span>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all duration-200"
            style={{
              background: 'rgba(255,59,48,0.06)',
              border: '1px solid rgba(255,59,48,0.15)',
              color: 'rgba(255,59,48,0.6)',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
