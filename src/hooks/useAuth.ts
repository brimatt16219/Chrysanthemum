import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { CloudProfile } from "../store/cloudSave";
import { getProfile } from "../store/cloudSave";

export interface AuthState {
  user: User | null;
  profile: CloudProfile | null;
  loading: boolean;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null;
      const profile = user ? await getProfile(user.id) : null;
      setAuth({ user, profile, loading: false });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user ?? null;
        const profile = user ? await getProfile(user.id) : null;
        setAuth({ user, profile, loading: false });
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    // Open about:blank FIRST — window.open must be called synchronously
    // inside the click handler (within the browser's user-gesture window).
    // Calling it after any await causes browsers to treat it as a pop-up
    // and block it, silently falling through to the redirect.
    const w    = 500, h = 650;
    const left = Math.round(window.screenX + (window.outerWidth  - w) / 2);
    const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
    const popup = window.open(
      "about:blank",
      "google-signin",
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`,
    );

    // Now fetch the OAuth URL (async is fine — the popup is already ours).
    const { data } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true,
      },
    });

    if (popup && !popup.closed && data.url) {
      // Navigate the already-open popup to Google's account chooser.
      popup.location.href = data.url;
    } else {
      // Popup was blocked or URL unavailable — fall back to redirect.
      popup?.close();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { ...auth, signInWithGoogle, signOut };
}