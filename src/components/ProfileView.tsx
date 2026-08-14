"use client";

import { useState } from "react";
import { UserCircle2, ShieldCheck, Download, TriangleAlert } from "lucide-react";
import { useElite } from "@/context/EliteContext";
import { useAuth } from "@/context/AuthContext";
import { DELETE_CONFIRMATION, USERNAME_RULE_TEXT } from "@/lib/auth-rules";

export default function ProfileView() {
  const { user, session, signOut } = useAuth();
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

  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const err = await updateUsername(nextUsername);
    if (err) setError(err);
    else setMessage("Username updated.");
    setSaving(false);
  }

  /*
   * These two talk to the API directly rather than through EliteContext, which
   * owns every other call. Neither is a mutation of the app model the context
   * holds: one streams a file to disk, and the other ends the session it would
   * have updated.
   */
  async function handleExport() {
    setExporting(true);
    setDangerError(null);
    try {
      const res = await fetch("/api/account/export", {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      if (!res.ok) throw new Error("Export failed. Try again in a moment.");

      // Anchor-and-revoke rather than navigating: navigation would tear down
      // the app to fetch a file it already has in memory.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `eliteos-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDangerError(
        err instanceof Error ? err.message : "Export failed. Try again."
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (confirmText !== DELETE_CONFIRMATION) return;
    setDeleting(true);
    setDangerError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ confirmation: DELETE_CONFIRMATION }),
      });
      if (!res.ok) throw new Error("Could not delete the account. Try again.");

      // The account is gone; the session in this tab is now a token for a user
      // that no longer exists. Clear it rather than leaving the app to discover
      // that on its next request.
      await signOut();
    } catch (err) {
      setDangerError(
        err instanceof Error ? err.message : "Could not delete the account."
      );
      setDeleting(false);
    }
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
          {USERNAME_RULE_TEXT}.
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

      <div className="glass p-5 border border-card-border space-y-3">
        <div className="flex items-center gap-2">
          <Download size={15} className="text-cyan" />
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">
            Your data
          </p>
        </div>
        <p className="text-sm text-muted">
          Download everything EliteOS holds about you as a single JSON file.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-cyan/15 text-cyan hover:bg-cyan/25 disabled:opacity-50 cursor-pointer"
        >
          {exporting ? "PREPARING..." : "EXPORT MY DATA"}
        </button>
        <p className="text-[11px] text-dim">
          Daily logs are kept for about 30 days, so the export covers that
          window rather than your whole history.
        </p>
      </div>

      <div className="glass p-5 border border-pink/30 space-y-3">
        <div className="flex items-center gap-2">
          <TriangleAlert size={15} className="text-pink" />
          <p className="text-xs uppercase tracking-wider text-pink font-semibold">
            Delete account
          </p>
        </div>
        <p className="text-sm text-muted">
          Permanently deletes your account and everything in it — objectives,
          habits, non-negotiables, logs, streaks and friendships.{" "}
          <span className="text-pink">This cannot be undone.</span> Export your
          data first if you want a copy.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Type ${DELETE_CONFIRMATION} to confirm`}
            aria-label={`Type ${DELETE_CONFIRMATION} to confirm account deletion`}
            className="flex-1 bg-black/30 border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-pink"
          />
          <button
            onClick={handleDelete}
            // Stays disabled until the word is typed exactly, so the
            // irreversible action cannot be reached by one stray click.
            disabled={deleting || confirmText !== DELETE_CONFIRMATION}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-pink/15 text-pink hover:bg-pink/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {deleting ? "DELETING..." : "DELETE FOREVER"}
          </button>
        </div>
        {dangerError && <p className="text-xs text-pink">{dangerError}</p>}
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
