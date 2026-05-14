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
  // Determine whether we're running inside a popup or the main window.
  // window.opener is set when this window was opened via window.open().
  // If it's not set we're the main window — the popup was blocked and the
  // fallback full-page redirect landed here instead.
  const _isPopup = !!window.opener && window.opener !== window;

  supabase.auth.getSession().then(({ data }) => {
    if (_isPopup) {
      // Popup flow: close the popup so the parent window resumes.
      if (data.session) { window.close(); return; }
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session) window.close();
      });
    } else {
      // Fallback redirect flow (popup was blocked): navigate to the clean
      // origin URL so the main window doesn't stay on "Signing in…".
      // The session is now in localStorage; the fresh load will pick it up.
      if (data.session) { window.location.replace(window.location.origin); return; }
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session) window.location.replace(window.location.origin);
      });
    }
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
