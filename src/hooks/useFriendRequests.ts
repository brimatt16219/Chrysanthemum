import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getPendingRequestCount } from "../store/cloudSave";

export function useFriendRequests(userId: string | null) {
  const [pendingCount, setPendingCount] = useState(0);
  const [newRequest, setNewRequest]     = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Load initial count
    getPendingRequestCount(userId).then(setPendingCount);

    // Subscribe to real-time changes
    const channel = supabase
      .channel("friendship-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setPendingCount((c) => c + 1);
            setNewRequest(true);
            // Auto-clear the notification after 5s
            setTimeout(() => setNewRequest(false), 5_000);
          }
          if (payload.eventType === "DELETE") {
            setPendingCount((c) => Math.max(0, c - 1));
          }
          if (payload.eventType === "UPDATE") {
            // Request was accepted — no longer pending
            getPendingRequestCount(userId).then(setPendingCount);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  function clearNewRequest() { setNewRequest(false); }

  return { pendingCount, newRequest, clearNewRequest };
}