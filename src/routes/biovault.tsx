import { createFileRoute } from '@tanstack/react-router';
import React, { Suspense } from 'react';

const BioVaultView = React.lazy(() => import('../components/Views/BioVaultView'));

function BioVaultPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111110 100%)' }}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400"
                style={{ animation: 'spin 1s linear infinite' }}
              />
              <span className="text-[13px] tracking-widest" style={{ color: 'rgba(0,255,204,0.5)' }}>
                Loading BioVault...
              </span>
            </div>
          </div>
        }
      >
        <div className="pt-6 pb-24">
          <BioVaultView />
        </div>
      </Suspense>
    </div>
  );
}

export const Route = createFileRoute('/biovault')({
  component: BioVaultPage,
});
