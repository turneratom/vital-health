import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useBindTwinSession } from "@/hooks/useBindTwinSession";

function RootLayout() {
  // Bind auth userId → twin sessionId for all routes (guest path unchanged until auth)
  useBindTwinSession();

  return (
    <div style={{ minHeight: '100vh', background: '#0A0908', color: '#E8E0D8' }}>
      <Outlet />
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: ({ error }) => (
    <div style={{ padding: 24, color: '#C4A46C', background: '#0A0908', minHeight: '100vh' }}>
      <div style={{ fontSize: 13, letterSpacing: '0.25em', fontWeight: 600, marginBottom: 12 }}>VIVE SYSTEM ERROR</div>
      <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>
        {error instanceof Error ? (error.stack || error.message) : String(error)}
      </pre>
    </div>
  ),
});
