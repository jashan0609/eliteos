"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Swords, UserPlus, UserRound, Users } from "lucide-react";
import { useElite } from "@/context/EliteContext";

export default function GhostView() {
  const {
    username,
    setUsername,
    sendFriendRequest,
    respondToFriendRequest,
    removeFriend,
    friendsInbound,
    friendsOutbound,
    leaderboard,
    friendCount,
    arenaLoading,
  } = useElite();
  const [usernameInput, setUsernameInput] = useState(username);
  const [friendInput, setFriendInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const friendsOnBoard = useMemo(
    () => leaderboard.filter((entry) => !entry.isSelf),
    [leaderboard]
  );

  async function handleUsernameSave() {
    setError(null);
    const err = await setUsername(usernameInput);
    if (err) setError(err);
  }

  async function handleFriendRequest() {
    setError(null);
    const err = await sendFriendRequest(friendInput);
    if (err) {
      setError(err);
      return;
    }
    setFriendInput("");
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass p-5 md:p-6 border border-cyan/20"
      >
        <div className="flex items-center gap-2 mb-3">
          <Swords size={16} strokeWidth={1.7} className="text-cyan" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan">
            Friends Arena
          </span>
        </div>
        <h3 className="text-lg font-semibold text-text">Compete with real friends</h3>
        <p className="text-sm text-muted mt-2">
          Add friends by username, compare rolling 7-day consistency scores, and
          keep each other accountable.
        </p>
        <p className="text-xs text-dim mt-3">
          Friends connected: <span className="text-text tabular-nums">{friendCount}</span>
        </p>
      </motion.div>

      <div className="glass p-5 border border-card-border space-y-3">
        <div className="flex items-center gap-2">
          <UserRound size={14} className="text-violet" />
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">
            Your Username
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="your_handle"
            className="flex-1 bg-black/30 border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan"
          />
          <button
            onClick={handleUsernameSave}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-cyan/15 text-cyan hover:bg-cyan/25"
          >
            SAVE
          </button>
        </div>
      </div>

      <div className="glass p-5 border border-card-border space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus size={14} className="text-pink" />
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">
            Add Friend
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={friendInput}
            onChange={(e) => setFriendInput(e.target.value)}
            placeholder="friend_username"
            className="flex-1 bg-black/30 border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink"
          />
          <button
            onClick={handleFriendRequest}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-pink/15 text-pink hover:bg-pink/25"
          >
            SEND
          </button>
        </div>
        {error && <p className="text-xs text-pink">{error}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass p-4 border border-card-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Incoming Requests
          </p>
          <div className="space-y-2">
            {friendsInbound.length === 0 && (
              <p className="text-xs text-dim">No pending incoming requests.</p>
            )}
            {friendsInbound.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between bg-black/20 border border-card-border rounded-lg px-3 py-2"
              >
                <span className="text-sm text-text">{request.username}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondToFriendRequest(request.id, "accept")}
                    className="text-[10px] px-2 py-1 rounded bg-cyan/15 text-cyan"
                  >
                    ACCEPT
                  </button>
                  <button
                    onClick={() => respondToFriendRequest(request.id, "decline")}
                    className="text-[10px] px-2 py-1 rounded bg-card-border text-muted"
                  >
                    DECLINE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass p-4 border border-card-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Outgoing Requests
          </p>
          <div className="space-y-2">
            {friendsOutbound.length === 0 && (
              <p className="text-xs text-dim">No pending outgoing requests.</p>
            )}
            {friendsOutbound.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between bg-black/20 border border-card-border rounded-lg px-3 py-2"
              >
                <span className="text-sm text-text">{request.username}</span>
                <span className="text-[10px] text-dim">PENDING</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass p-5 border border-card-border">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-cyan" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            7-Day Leaderboard
          </p>
        </div>
        <div className="space-y-2">
          {leaderboard.length === 0 && (
            <p className="text-xs text-dim">
              No leaderboard entries yet. Set username and add friends to start.
            </p>
          )}
          {leaderboard.map((entry) => (
            <div
              key={entry.userId}
              className={`grid grid-cols-[48px_1fr_auto_auto_auto] gap-3 items-center px-3 py-2 rounded-lg border ${
                entry.isSelf ? "border-cyan/40 bg-cyan/10" : "border-card-border bg-black/20"
              }`}
            >
              <span className="text-xs tabular-nums text-muted">#{entry.rank}</span>
              <span className="text-sm text-text truncate">{entry.username}</span>
              <span className="text-xs text-dim tabular-nums">XP {entry.xp}</span>
              <span className="text-xs text-dim tabular-nums">STK {entry.streak}</span>
              <span className="text-xs text-text tabular-nums">
                {entry.score === null ? "--" : entry.score}
              </span>
            </div>
          ))}
        </div>
        {!arenaLoading && friendsOnBoard.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {friendsOnBoard.map((friend) => (
              <button
                key={`remove-${friend.userId}`}
                onClick={() => removeFriend(friend.userId)}
                className="text-[10px] px-2 py-1 rounded bg-pink/10 text-pink"
              >
                UNFRIEND {friend.username}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
