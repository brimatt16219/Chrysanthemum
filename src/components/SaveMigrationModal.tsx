import type { GameState } from "../store/gameStore";

interface Props {
  localSave: GameState;
  cloudSave: GameState;
  onChoose: (choice: "local" | "cloud") => void;
}

function formatSave(save: GameState) {
  const date = new Date(save.lastSaved).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
  return { coins: save.coins.toLocaleString(), date };
}

export function SaveMigrationModal({ localSave, cloudSave, onChoose }: Props) {
  const local = formatSave(localSave);
  const cloud = formatSave(cloudSave);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-primary/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <p className="text-3xl">💾</p>
          <h2 className="text-lg font-bold">Two saves found</h2>
          <p className="text-sm text-muted-foreground">
            You have a local save and a cloud save. Which one do you want to keep?
          </p>
        </div>

        <div className="space-y-3">
          {/* Local save option */}
          <button
            onClick={() => onChoose("local")}
            className="w-full text-left bg-background border border-border hover:border-primary/50 rounded-xl px-4 py-3 transition-colors group"
          >
            <p className="text-sm font-semibold group-hover:text-primary transition-colors">
              💻 Local Save
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {local.coins} coins · Last saved {local.date}
            </p>
          </button>

          {/* Cloud save option */}
          <button
            onClick={() => onChoose("cloud")}
            className="w-full text-left bg-background border border-border hover:border-primary/50 rounded-xl px-4 py-3 transition-colors group"
          >
            <p className="text-sm font-semibold group-hover:text-primary transition-colors">
              ☁️ Cloud Save
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {cloud.coins} coins · Last saved {cloud.date}
            </p>
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          The save you don't choose will be permanently discarded.
        </p>
      </div>
    </div>
  );
}