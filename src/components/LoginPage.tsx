interface Props {
  onSignIn: () => void;
  onGuest:  () => void;
}

export function LoginPage({ onSignIn, onGuest }: Props) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-8">

      {/* Branding */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="text-6xl">🌸</div>
        <h1 className="text-3xl font-bold text-primary tracking-wide">Chrysanthemum</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Grow rare flowers, discover mutations, and build the ultimate garden.
        </p>
      </div>

      {/* Decorative flower row */}
      <div className="flex gap-3 text-3xl select-none">
        <span>🌷</span><span>🌼</span><span>🌺</span><span>🌻</span><span>🌹</span>
      </div>

      {/* Auth buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onSignIn}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Sign in with Google
        </button>
        <button
          onClick={onGuest}
          className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          Play as guest
        </button>
        <p className="text-center text-[10px] text-muted-foreground px-2">
          Guest progress saves locally only and won't sync across devices.
        </p>
      </div>

    </div>
  );
}