import { useEffect, useState } from "react";

const CURRENT_VERSION = __APP_VERSION__;
// const CHECK_INTERVAL  = 60_000; // check every 60 seconds

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Don't check on localhost — dev server doesn't build version.json
    if (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1") {
      return;
    }

    async function check() {
      try {
        const res  = await fetch(`/version.json?t=${Date.now()}`);
        const data = await res.json();
        if (data.version !== CURRENT_VERSION) {
          setUpdateAvailable(true);
        }
      } catch {
        // ignore
      }
    }

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  return updateAvailable;
}