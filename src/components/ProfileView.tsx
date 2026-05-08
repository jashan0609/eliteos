"use client";

import { useState } from "react";
import { UserCircle2, ShieldCheck } from "lucide-react";
import { useElite } from "@/context/EliteContext";
import { useAuth } from "@/context/AuthContext";

export default function ProfileView() {
  const { user } = useAuth();
  const {
    username,
    timezone,
    initializedAt,
    xp,
    streak,
    friendCount,
    levelData,
    updateUsername,
  } = useElite();
  const [nextUsername, setNextUsername] = useState(username);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const err = await updateUsername(nextUsername);
    if (err) setError(err);
    else setMessage("Username updated.");
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <div className="glass p-5 border border-card-border">
        <div className="flex items-center gap-2 mb-3">
          <UserCircle2 size={16} className="text-cyan" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan">
            Profile
          </p>
        </div>
        <p className="text-sm text-muted">
          Manage your account identity and view your core account data.
        </p>
      </div>

      <div className="glass p-5 border border-card-border space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted font-semibold">
          Username
        </p>
        <div className="flex gap-2">
          <input
            value={nextUsername}
            onChange={(e) => setNextUsername(e.target.value.toLowerCase())}
            className="flex-1 bg-black/30 border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan"
            placeholder="your_handle"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-cyan/15 text-cyan hover:bg-cyan/25 disabled:opacity-50"
          >
            {saving ? "SAVING..." : "SAVE"}
          </button>
        </div>
        <p className="text-[11px] text-dim">
          3-24 chars: lowercase letters, numbers, underscore.
        </p>
        {message && <p className="text-xs text-cyan">{message}</p>}
        {error && <p className="text-xs text-pink">{error}</p>}
      </div>

      <div className="glass p-5 border border-card-border">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={15} className="text-violet" />
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">
            Account Data
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Stat label="Email" value={user?.email ?? "unknown"} />
          <Stat label="Created" value={new Date(initializedAt).toLocaleString()} />
          <Stat label="Timezone" value={timezone} />
          <Stat label="Level / Rank" value={`${levelData.currentLevel} / ${levelData.rankName}`} />
          <Stat label="XP" value={`${xp}`} />
          <Stat label="Streak" value={`${streak}`} />
          <Stat label="Friends" value={`${friendCount}`} />
          <Stat label="Username" value={username || "--"} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/20 border border-card-border rounded-lg px-3 py-2">
      <p className="text-[10px] text-dim uppercase tracking-wider">{label}</p>
      <p className="text-text mt-1 break-all">{value}</p>
    </div>
  );
}
