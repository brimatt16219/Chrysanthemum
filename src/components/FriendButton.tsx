import { useEffect, useState } from "react";
import {
  getFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  type FriendshipStatus,
} from "../store/cloudSave";
import { useGame } from "../store/GameContext";

interface Props {
  theirId: string;
  theirUsername: string;
}

export function FriendButton({ theirId, theirUsername }: Props) {
  const { user } = useGame();
  const [status, setStatus]           = useState<FriendshipStatus>("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [acting, setActing]           = useState(false);

  useEffect(() => {
    if (!user) return;
    getFriendshipStatus(user.id, theirId).then(({ status: s, friendshipId: fid }) => {
      setStatus(s);
      setFriendshipId(fid);
      setLoading(false);
    });
  }, [user, theirId]);

  if (!user || user.id === theirId) return null;
  if (loading) return (
    <div className="w-28 h-8 rounded-lg bg-card/60 border border-border animate-pulse" />
  );

  async function handleClick() {
    if (!user || acting) return;
    setActing(true);

    if (status === "none") {
      const ok = await sendFriendRequest(user.id, theirId);
      if (ok) setStatus("pending_sent");
    } else if (status === "pending_received" && friendshipId) {
      const ok = await acceptFriendRequest(friendshipId);
      if (ok) setStatus("accepted");
    } else if ((status === "pending_sent" || status === "accepted") && friendshipId) {
      const ok = await removeFriendship(friendshipId);
      if (ok) { setStatus("none"); setFriendshipId(null); }
    }

    setActing(false);
  }

  const config: Record<FriendshipStatus, { label: string; style: string }> = {
    none:             { label: "Add Friend",     style: "bg-primary text-primary-foreground hover:opacity-90" },
    pending_sent:     { label: "Request Sent",   style: "border border-border text-muted-foreground hover:border-red-400 hover:text-red-400" },
    pending_received: { label: "Accept Request", style: "bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30" },
    accepted:         { label: "Friends ✓",      style: "border border-primary/40 text-primary hover:border-red-400 hover:text-red-400" },
  };

  const { label, style } = config[status];

  return (
    <button
      onClick={handleClick}
      disabled={acting}
      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 disabled:opacity-50 ${style}`}
    >
      {acting ? "..." : label}
    </button>
  );
}