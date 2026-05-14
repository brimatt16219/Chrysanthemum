// ── Login audio singleton ──────────────────────────────────────────────────
// Lives at module scope so it survives React unmounts.
//
// Browser autoplay policy:
//   - Unmuted play() on a fresh page load → BLOCKED until a user gesture.
//   - Muted play() → allowed by Chrome immediately (audio element).
//   - Setting .muted = false on an ALREADY-PLAYING element → no gesture needed.
//   - Calling play() from mousemove → still blocked (not a user-activation event).
//   - Calling play() from pointerdown/keydown → allowed (user-activation event).
//
// Strategy:
//   1. Start muted — muted autoplay is always permitted.
//   2. mousemove:    if the element is already playing (muted), just unmute it.
//                    If it's paused (muted play also failed), do nothing — keep
//                    the pointerdown/keydown listeners alive.
//   3. pointerdown / keydown: unmute AND call play() — these are real user-
//                    activation events so play() is guaranteed to succeed.

const LOGIN_TRACKS = [
  "/audio/music/dragonica_title_screen.mp3",
  "/audio/music/acnh_6pm.mp3",
  "/audio/music/dusk_in_mondstadt.mp3",
];

let _el:      HTMLAudioElement | null = null;
let _trackIdx = 0;

type Handler = () => void;
let _pointerHandler: Handler | null = null;
let _keyHandler:     Handler | null = null;
let _moveHandler:    Handler | null = null;

// ── Track advance ──────────────────────────────────────────────────────────

function _advance() {
  if (!_el) return;
  _trackIdx = (_trackIdx + 1) % LOGIN_TRACKS.length;
  _el.src   = LOGIN_TRACKS[_trackIdx];
  void _el.play().catch(() => {});
}

// ── Unlock helpers ─────────────────────────────────────────────────────────

/** mousemove — NOT a user-activation event, so we cannot call play().
 *  If the element is already playing muted, just unmute it.
 *  If it's paused (muted play also failed), do nothing — leave the
 *  pointerdown/keydown listeners in place so a real gesture can start it. */
function _unmute() {
  if (!_el || _el.paused) return; // paused = muted play blocked; wait for real gesture
  _el.muted = false;
  _detachAll();
}

/** pointerdown / keydown — real user-activation events.
 *  Unmute and call play(); the browser will allow it. */
function _unlock() {
  if (!_el) return;
  _el.muted = false;
  void _el.play().catch(() => {});
  _detachAll();
}

function _attachListeners() {
  if (_pointerHandler) return; // already attached
  _pointerHandler = _unlock;
  _keyHandler     = _unlock;
  _moveHandler    = _unmute;   // separate: only unmutes if already playing
  document.addEventListener("pointerdown", _pointerHandler);
  document.addEventListener("keydown",     _keyHandler);
  document.addEventListener("mousemove",   _moveHandler);
}

function _detachAll() {
  if (_pointerHandler) { document.removeEventListener("pointerdown", _pointerHandler); _pointerHandler = null; }
  if (_keyHandler)     { document.removeEventListener("keydown",     _keyHandler);     _keyHandler     = null; }
  if (_moveHandler)    { document.removeEventListener("mousemove",   _moveHandler);    _moveHandler    = null; }
}

// ── Public API ────────────────────────────────────────────────────────────

/** Begin login music. Safe to call multiple times. */
export function startLoginMusic(): void {
  // Already running audibly — nothing to do.
  if (_el && !_el.paused && !_el.muted) return;

  // Element exists but muted/paused — re-attach listeners and retry play.
  if (_el) {
    void _el.play().catch(() => {});
    _attachListeners();
    return;
  }

  // Fresh start.
  _trackIdx  = 0;
  const el   = new Audio();
  el.preload = "auto";
  el.muted   = true;  // muted play is always permitted — starts silently
  el.volume  = 0.5;   // stored so unmuting is instant (no fade needed)
  el.src     = LOGIN_TRACKS[0];
  el.addEventListener("ended", _advance);
  _el = el;

  void el.play().catch(() => {
    // Even muted play was blocked (very rare).
    // Listeners are already attached; pointerdown/keydown will start it.
  });

  _attachListeners();
}

/** Hard-stop login music and release the element. */
export function stopLoginMusic(): void {
  _detachAll();
  if (!_el) return;
  _el.removeEventListener("ended", _advance);
  _el.pause();
  _el.src = "";
  _el     = null;
}
