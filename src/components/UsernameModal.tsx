import { useState } from "react";
import { createProfile } from "../store/cloudSave";
import type { User } from "@supabase/supabase-js";

interface Props {
  user: User;
  onComplete: (username: string) => void;
}

export function UsernameModal({ user, onComplete }: Props) {
  const [username, setUsername] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit() {
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (trimmed.length > 20) {
      setError("Username must be 20 characters or less.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Only letters, numbers, and underscores.");
      return;
    }

    setLoading(true);
    setError("");

    const profile = await createProfile(user.id, trimmed);
    if (!profile) {
      setError("That username is taken. Try another.");
      setLoading(false);
      return;
    }

    onComplete(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-primary/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <p className="text-3xl">🌸</p>
          <h2 className="text-lg font-bold">Choose a username</h2>
          <p className="text-sm text-muted-foreground">
            This is how other players will find you.
          </p>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="e.g. garden_brian"
            maxLength={20}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
          />
          {error && (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !username.trim()}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Saving..." : "Let's grow! 🌱"}
        </button>
      </div>
    </div>
  );
}