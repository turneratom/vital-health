import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'vive-demo-disclaimer-dismissed';

/**
 * Small first-run (dismissible) banner: personal twin prototype /
 * not medical advice / demo data may be empty.
 */
export function DemoDisclaimerBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      /* show if storage unavailable */
    }
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="mx-auto mb-4 max-w-[640px] px-5"
      style={{ paddingTop: 4 }}
    >
      <div
        className="flex items-start gap-3 rounded-xl px-3.5 py-2.5"
        style={{
          background: 'rgba(196,164,108,0.08)',
          border: '1px solid rgba(196,164,108,0.22)',
        }}
      >
        <span className="text-sm leading-none mt-0.5" aria-hidden>
          ℹ
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="font-mono text-[10px] tracking-[0.06em] uppercase mb-0.5"
            style={{ color: 'rgba(196,164,108,0.9)' }}
          >
            Personal twin prototype
          </p>
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: 'rgba(232,224,216,0.55)' }}
          >
            Not medical advice. Demo data may be empty until you log food,
            vitals, or paste labs into Bio-Vault.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 font-mono text-[10px] tracking-wider uppercase px-2 py-1 rounded-md"
          style={{
            color: 'rgba(232,224,216,0.45)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
          }}
          aria-label="Dismiss demo disclaimer"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default DemoDisclaimerBanner;
