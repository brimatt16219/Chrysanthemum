import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getPendingGiftCount } from "../store/cloudSave";

export function useGiftNotifications(userId: string | null) {
  const [pendingCount, setPendingCount] = useState(0);
  const [newGift, setNewGift]           = useState(false);

  useEffect(() => {
    if (!userId) return;

    getPendingGiftCount(userId).then(setPendingCount);

    const channel = supabase
      .channel("gift-changes")
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "gifts",
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          setPendingCount((c) => c + 1);
          setNewGift(true);
          setTimeout(() => setNewGift(false), 5_000);
        }
      )
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "gifts",
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          getPendingGiftCount(userId).then(setPendingCount);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return { pendingCount, newGift, clearNewGift: () => setNewGift(false) };
}