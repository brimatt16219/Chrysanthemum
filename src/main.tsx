import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameProvider } from "./store/GameContext";
import App from "./App";
import "./index.css";
import * as Sentry from "@sentry/react";
import { supabase } from "./lib/supabase";

// window.__oauthCallback is set by an inline <script> in index.html before
// any module code runs — the only reliable way to read ?code=&state= before
// Supabase's detectSessionInUrl strips them from the URL.
const _isOAuthCallback = !!(window as unknown as Record<string, unknown>).__oauthCallback;

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
  environment: import.meta.env.MODE,
});

// ── OAuth popup callback handler ───────────────────────────────────────────
// After Google OAuth, the popup lands back on our origin with ?code=&state=
// in the URL (Supabase PKCE flow). Detect this case and render a minimal
// "Signing in…" screen instead of the full app, then close the popup once
// Supabase has exchanged the code for a session.
//
// window.__oauthCallback is set by the inline <script> in index.html before
// any module JS runs — the only reliable way to capture ?code=&state= before
// Supabase's detectSessionInUrl strips them from the URL.
if (_isOAuthCallback) {
  // Let Supabase exchange the code for tokens (happens automatically on init).
  // Close the popup once the session is ready.
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) { window.close(); return; }
    // Not ready yet — wait for the exchange to complete.
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) window.close();
    });
  });

  createRoot(document.getElementById("root")!).render(
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", fontFamily: "sans-serif", fontSize: "1rem",
      color: "#888", background: "#0f0f0f",
    }}>
      Signing in…
    </div>
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <GameProvider>
        <App />
      </GameProvider>
    </StrictMode>
  );
}
