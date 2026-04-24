interface Props {
  onDismiss: () => void;
}

export function UpdateBanner({ onDismiss }: Props) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-lg flex-shrink-0">🌸</span>
        <div>
          <p className="text-sm font-semibold">A new version is available</p>
          <p className="text-xs opacity-80">Refresh to get the latest updates.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => window.location.reload()}
          className="text-xs px-3 py-1.5 rounded-lg bg-primary-foreground text-primary font-semibold hover:opacity-90 transition-opacity"
        >
          Refresh
        </button>
        <button
          onClick={onDismiss}
          className="text-xs opacity-70 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
    </div>
  );
}