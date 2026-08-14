"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { USERNAME_PATTERN, USERNAME_RULE_TEXT } from "@/lib/auth-rules";
// `buildResetPlan` and `getUpdatedGlobalStreak` are gone from this file as of
// Phase 4: the reset they powered now runs server-side in
// `src/lib/server/run-daily-reset.ts`, reached via POST /api/system/sync.
import { toDateStr, type ResettableHabit } from "@/lib/daily-reset";
import {
  applyXpDelta,
  computeToggle,
  xpForHabitKind,
  XP_PER_DAILY_HABIT,
  XP_PER_NON_NEGOTIABLE,
  type HabitKind,
} from "@/lib/economy";
import { useAuth } from "@/context/AuthContext";
import XPToast from "@/components/XPToast";
import LevelUpToast from "@/components/LevelUpToast";

// ── Types ──

export interface Objective {
  id: string;
  type: "north-star" | "sprint";
  title: string;
  description: string;
  progress: number;
  status: "Active" | "Completed";
}

export interface Habit {
  id: string;
  title: string;
  completedToday: boolean;
  streak: number;
}

export interface DailyPerformanceLog {
  date: string;
  nnSummary: { title: string; completed: boolean }[];
  habitSummary: { title: string; completed: boolean }[];
  totalXpAtTime: number;
  penalty: number;
}

interface EliteState {
  xp: number;
  streak: number;
  lastCheckIn: string | null;
  lastHabitReset: string | null;
  username: string;
  timezone: string;
  initializedAt: string;
  objectives: Objective[];
  dailyHabits: Habit[];
  nonNegotiables: Habit[];
  logs: DailyPerformanceLog[];
  friendsInbound: FriendRequestItem[];
  friendsOutbound: FriendRequestItem[];
  leaderboard: ArenaLeaderboardItem[];
  friendCount: number;
}

interface FriendRequestItem {
  id: string;
  userId: string;
  username: string;
  createdAt: string;
}

interface ArenaLeaderboardItem {
  rank: number;
  userId: string;
  username: string;
  xp: number;
  streak: number;
  score: number | null;
  hasEnoughData: boolean;
  isSelf: boolean;
}

// ── Leveling System ──

export interface LevelData {
  currentLevel: number;
  rankName: string;
  levelProgress: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
}

const RANK_TIERS = [
  { level: 1, name: "BEGINNER",   min: 0,      max: 999    },
  { level: 2, name: "AMATEUR",    min: 1_000,  max: 4_999  },
  { level: 3, name: "DISCIPLINED",min: 5_000,  max: 14_999 },
  { level: 4, name: "CHAMPION",   min: 15_000, max: 29_999 },
  { level: 5, name: "MASTER",     min: 30_000, max: 49_999 },
  { level: 6, name: "ELITE",      min: 50_000, max: Infinity },
] as const;

export function getLevelData(xp: number): LevelData {
  const tier = RANK_TIERS.find((t) => xp <= t.max) ?? RANK_TIERS[RANK_TIERS.length - 1];
  const xpForCurrentLevel = tier.min;
  const xpForNextLevel = tier.max === Infinity ? tier.min : tier.max + 1;
  const range = xpForNextLevel - xpForCurrentLevel;
  const levelProgress =
    tier.max === Infinity ? 100 : ((xp - tier.min) / range) * 100;

  return {
    currentLevel: tier.level,
    rankName: tier.name,
    levelProgress: Math.min(Math.max(levelProgress, 0), 100),
    xpForCurrentLevel,
    xpForNextLevel,
  };
}

interface EliteContextValue extends EliteState {
  loading: boolean;
  arenaLoading: boolean;
  loadError: string | null;
  retryLoad: () => void;
  /** True once an API response reports a newer build than this tab is running. */
  buildMismatch: boolean;
  levelData: LevelData;
  // Every write now reports failure instead of swallowing it. `null` means it
  // landed; a string is a message worth showing.
  addObjective: (
    obj: Omit<Objective, "id" | "progress" | "status">
  ) => Promise<string | null>;
  incrementObjectiveProgress: (id: string) => Promise<string | null>;
  deleteObjective: (id: string) => Promise<string | null>;
  editObjective: (
    id: string,
    data: { title: string; description: string }
  ) => Promise<string | null>;
  addDailyHabit: (title: string) => Promise<string | null>;
  editDailyHabit: (id: string, title: string) => Promise<string | null>;
  deleteDailyHabit: (id: string) => Promise<string | null>;
  addNonNegotiable: (title: string) => Promise<string | null>;
  editNonNegotiable: (id: string, title: string) => Promise<string | null>;
  deleteNonNegotiable: (id: string) => Promise<string | null>;
  // Deliberately still `void`: the optimistic update plus reconcile-on-response
  // means callers have nothing useful to await, and keeping this signature is
  // what lets HabitsView stay completely unchanged.
  toggleDailyHabit: (id: string) => void;
  toggleNonNegotiable: (id: string) => void;
  updateUsername: (username: string) => Promise<string | null>;
  sendFriendRequest: (username: string) => Promise<string | null>;
  respondToFriendRequest: (
    requestId: string,
    action: "accept" | "decline"
  ) => Promise<string | null>;
  removeFriend: (friendUserId: string) => Promise<string | null>;
  refreshFriendsArena: () => Promise<void>;
  showToast: (type: "gain" | "loss", amount: number, message: string) => void;
}

const DEFAULT_STATE: EliteState = {
  xp: 0,
  streak: 0,
  lastCheckIn: null,
  lastHabitReset: null,
  username: "",
  timezone: "UTC",
  initializedAt: new Date().toISOString(),
  objectives: [],
  dailyHabits: [],
  nonNegotiables: [],
  logs: [],
  friendsInbound: [],
  friendsOutbound: [],
  leaderboard: [],
  friendCount: 0,
};

// ── Context ──

const EliteContext = createContext<EliteContextValue | null>(null);

export function useElite(): EliteContextValue {
  const ctx = useContext(EliteContext);
  if (!ctx) throw new Error("useElite must be used within EliteProvider");
  return ctx;
}

/**
 * The build this tab was loaded from. Compared against the `x-app-build`
 * header every API response carries; see `next.config.ts`.
 */
const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

/** Server state that superseded ours — a 409, not a failure. */
interface ServerStale {
  habit?: { id: string; completedToday: boolean; streak: number } | null;
  objective?: {
    id: string;
    progress: number;
    status: Objective["status"];
  } | null;
  xp?: number | null;
  streak?: number | null;
  lastCheckIn?: string | null;
}

class StaleStateError extends Error {
  readonly state: ServerStale | null;
  constructor(state: ServerStale | null) {
    super("STALE");
    this.name = "StaleStateError";
    this.state = state;
  }
}

// ── Haptic feedback (mobile only) ──

function haptic(pattern: number | number[] = 30) {
  // navigator.vibrate is Android Chrome only — iOS Safari does not support it
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

// `patchProfile` lived here until Phase 4. It is gone because nothing on the
// client writes to `operator_profile` any more except `updateUsername`, which
// does its own scoped update. Every XP and streak write goes through the API.

// ── Provider ──

export function EliteProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  // Depend on the *id*, never the `user` object. AuthContext calls
  // `setUser(s?.user ?? null)` on every `onAuthStateChange` event, which mints
  // a fresh object even when the signed-in operator has not changed. Effects
  // keyed on `user` therefore re-ran on every auth event, and because each
  // re-run issues Supabase requests that themselves settle the auth state,
  // the two fed each other into a permanent request storm.
  const userId = user?.id ?? null;
  const accessToken = session?.access_token ?? null;

  // This provider sits in the root layout, so it mounts on every route —
  // including the ones that exist only to complete an auth flow. A recovery
  // link creates a real session, which would otherwise be enough for the load
  // effect below to POST /api/system/sync and run the daily reset from a page
  // whose only job is changing a password. Stay dormant there.
  const pathname = usePathname();
  const dormant = pathname === "/reset-password";
  const [state, setState] = useState<EliteState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [arenaLoading, setArenaLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buildMismatch, setBuildMismatch] = useState(false);
  // Bumping this re-runs the load effect — the retry button's mechanism.
  const [reloadNonce, setReloadNonce] = useState(0);

  // Prevents rapid-fire toggles from creating race conditions
  const pendingToggles = useRef<Set<string>>(new Set());

  // XP Toast state
  const [toast, setToast] = useState({
    show: false,
    type: "gain" as "gain" | "loss",
    amount: 0,
    message: "",
  });

  // Level-up toast state
  const [levelUpToast, setLevelUpToast] = useState({
    show: false,
    level: 1,
    rankName: "BEGINNER",
    isRankUp: false,
  });

  /**
   * Thrown when the server reports 409 STALE. Carries the server's view of the
   * world so the caller can adopt it instead of rolling back — the correct
   * response to "another tab already did this".
   */
  const authedJson = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!accessToken) throw new Error("Not authenticated");
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(init?.headers ?? {}),
        },
      });

      // Tripwire: this tab was loaded from one build; the server is now
      // serving another. Old JS against a locked-down database is the Phase 5
      // failure mode, and a reload is the entire fix — so say so rather than
      // letting the user watch writes fail.
      const serverBuild = res.headers.get("x-app-build");
      if (
        serverBuild &&
        CLIENT_BUILD_ID &&
        serverBuild !== CLIENT_BUILD_ID
      ) {
        setBuildMismatch(true);
      }

      const data = await res.json().catch(() => null);

      if (res.status === 409 && data?.error === "STALE") {
        throw new StaleStateError(data.state ?? null);
      }
      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? "Request failed");
      }
      return data;
    },
    [accessToken]
  );

  // ── Fetch all data from Supabase on login ──
  useEffect(() => {
    let cancelled = false;

    if (!userId || dormant) {
      queueMicrotask(() => {
        if (cancelled) return;
        setState(DEFAULT_STATE);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setLoadError(null);
    });

    // Returns the loaded state rather than committing it, so the caller below
    // owns every setState — including the `finally` that clears the loading
    // flag on every exit path.
    async function fetchSystemState(): Promise<EliteState | null> {
      if (!userId) return null;
      // Log dates are written in the user's local day, so the retention window
      // has to be measured there too — otherwise users west of UTC lose a day.
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const retentionStart = toDateStr(
        new Date(Date.now() - 30 * 86_400_000),
        userTimezone
      );

      // ── Server-authoritative sync ──
      //
      // This replaces the reset that used to run here in the browser. That
      // block wrote xp, streak, last_habit_reset, per-habit streaks and
      // daily_logs directly, and it is the single reason those grants cannot
      // be revoked. The server now owns all of it; the client only reads.
      //
      // Everything below this point is a SELECT.
      const sync = await authedJson("/api/system/sync", {
        method: "POST",
        body: JSON.stringify({ timezone: userTimezone }),
      });
      if (cancelled) return null;

      const [profileRes, logsRes] = await Promise.all([
        supabase.from("operator_profile").select("*").eq("id", userId).single(),
        supabase
          .from("daily_logs")
          .select("*")
          .eq("user_id", userId)
          .gte("date", retentionStart)
          .order("date", { ascending: false }),
      ]);

      if (cancelled) return null;

      // The profile row is created by the `on_auth_user_created` trigger, in
      // the same transaction that creates the account. The client used to
      // insert it here and discard the error, which turned a username
      // collision into an account with no profile and a permanent spinner.
      const profileRow = profileRes.data;
      if (!profileRow) {
        throw new Error(
          "Your profile could not be loaded. If this persists, contact support."
        );
      }

      // Prefer the sync response for anything it owns — it is post-reset,
      // whereas the profile SELECT can race the reset it just performed.
      const profile = {
        ...profileRow,
        xp: sync.xp,
        streak: sync.streak,
        last_habit_reset: sync.lastHabitReset,
        timezone: sync.timezone ?? userTimezone,
      };

      const objRes = {
        data: (sync.objectives ?? []) as {
          id: string;
          type: string;
          title: string;
          description: string;
          progress: number;
          status: string;
        }[],
      };
      const dailyHabitRows = (sync.dailyHabits ?? []) as ResettableHabit[];
      const nonNegotiableRows = (sync.nonNegotiables ?? []) as ResettableHabit[];
      const logRows = logsRes.data ?? [];


      // Map DB rows to local types
      const objectives: Objective[] = (objRes.data ?? []).map((r) => ({
        id: r.id,
        type: r.type as "north-star" | "sprint",
        title: r.title,
        description: r.description,
        progress: r.progress,
        status: r.status as "Active" | "Completed",
      }));

      const dailyHabits: Habit[] = dailyHabitRows.map((r) => ({
        id: r.id,
        title: r.title,
        completedToday: r.completed_today,
        streak: r.streak,
      }));

      const nonNegotiables: Habit[] = nonNegotiableRows.map((r) => ({
        id: r.id,
        title: r.title,
        completedToday: r.completed_today,
        streak: r.streak,
      }));

      const logs: DailyPerformanceLog[] = logRows.map((r) => ({
        date: r.date,
        nnSummary: r.nn_summary as { title: string; completed: boolean }[],
        habitSummary: r.habit_summary as { title: string; completed: boolean }[],
        totalXpAtTime: r.total_xp_at_time,
        penalty: r.penalty,
      }));

      const loadedState: EliteState = {
        xp: profile.xp,
        streak: profile.streak,
        lastCheckIn: profile.last_check_in,
        lastHabitReset: profile.last_habit_reset,
        username: profile.username ?? "",
        timezone: profile.timezone ?? "UTC",
        initializedAt: profile.initialized_at,
        objectives,
        dailyHabits,
        nonNegotiables,
        logs,
        friendsInbound: [],
        friendsOutbound: [],
        leaderboard: [],
        friendCount: 0,
      };

      return loadedState;
    }

    fetchSystemState()
      .then((loadedState) => {
        if (cancelled || !loadedState) return;
        setState(loadedState);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[SYSTEM_STATE_LOAD_FAILURE]", err);
        setLoadError(
          err instanceof Error
            ? err.message
            : "Could not load your system state."
        );
      })
      .finally(() => {
        // Every exit path lands here. Previously an early return could leave
        // `loading` true forever, stranding the operator on the sync screen.
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // `authedJson` is keyed on the access token, so this re-runs when the
    // token refreshes — roughly hourly, and a full reload is the right
    // response to a new session anyway. It is emphatically *not* keyed on the
    // `user` object; see the note where `userId` is declared.
  }, [userId, dormant, reloadNonce, authedJson]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setReloadNonce((n) => n + 1);
  }, []);


  const refreshFriendsArena = useCallback(async (silent = false) => {
    if (!userId || !accessToken) {
      setState((prev) => ({
        ...prev,
        friendsInbound: [],
        friendsOutbound: [],
        leaderboard: [],
        friendCount: 0,
      }));
      return;
    }

    if (!silent) setArenaLoading(true);

    try {
      const [requestsData, leaderboardData] = await Promise.all([
        authedJson("/api/friends/requests"),
        authedJson("/api/friends/leaderboard"),
      ]);
      setState((prev) => ({
        ...prev,
        friendsInbound: requestsData.inbound ?? [],
        friendsOutbound: requestsData.outbound ?? [],
        leaderboard: leaderboardData.leaderboard ?? [],
        friendCount: leaderboardData.friendCount ?? 0,
      }));
    } catch (error) {
      console.error("[FRIENDS_ARENA_CLIENT_FAILURE]", error);
      setState((prev) => ({
        ...prev,
        friendsInbound: [],
        friendsOutbound: [],
        leaderboard: [],
        friendCount: 0,
      }));
    } finally {
      if (!silent) setArenaLoading(false);
    }
  }, [authedJson, accessToken, userId]);

  useEffect(() => {
    if (!userId || loading || dormant) return;
    refreshFriendsArena();
  }, [
    loading,
    dormant,
    refreshFriendsArena,
    state.logs.length,
    state.streak,
    userId,
  ]);

  const showToast = useCallback(
    (type: "gain" | "loss", amount: number, message: string) => {
      setToast({ show: true, type, amount, message });
      setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
    },
    []
  );

  const updateUsername = useCallback(
    async (username: string) => {
      if (!user) return "Not authenticated";
      const normalized = username.trim().toLowerCase();
      if (!USERNAME_PATTERN.test(normalized)) {
        return `Username must be ${USERNAME_RULE_TEXT}.`;
      }

      const { error } = await supabase
        .from("operator_profile")
        .update({ username: normalized })
        .eq("id", user.id);

      if (error) {
        if (error.code === "23505") {
          return "That username is already taken.";
        }
        return error.message;
      }

      setState((prev) => ({ ...prev, username: normalized }));
      return null;
    },
    [user]
  );

  const sendFriendRequest = useCallback(async (username: string) => {
    try {
      await authedJson("/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      void refreshFriendsArena(true);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Failed to send request";
    }
  }, [authedJson, refreshFriendsArena]);

  const respondToFriendRequest = useCallback(
    async (requestId: string, action: "accept" | "decline") => {
      try {
        await authedJson("/api/friends/respond", {
          method: "POST",
          body: JSON.stringify({ requestId, action }),
        });
        void refreshFriendsArena(true);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Failed to respond";
      }
    },
    [authedJson, refreshFriendsArena]
  );

  const removeFriend = useCallback(async (friendUserId: string) => {
    try {
      await authedJson("/api/friends/remove", {
        method: "POST",
        body: JSON.stringify({ friendUserId }),
      });
      void refreshFriendsArena(true);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Failed to remove friend";
    }
  }, [authedJson, refreshFriendsArena]);

  // ── XP side effects ──

  /**
   * Level-up and rank-up toasts, driven by observed XP rather than by the
   * writer that caused it.
   *
   * This used to live inside `updateXP`, which no UI ever called — so the
   * toast fired for exactly nothing. On an effect it fires for every XP
   * change, including the server-confirmed reset penalties, which is where it
   * always belonged.
   */
  const prevXpRef = useRef<number | null>(null);
  useEffect(() => {
    const previous = prevXpRef.current;
    prevXpRef.current = state.xp;
    if (previous === null || state.xp <= previous) return;

    const before = getLevelData(previous);
    const after = getLevelData(state.xp);
    const isRankUp = after.rankName !== before.rankName;
    const isLevelUp = after.currentLevel > before.currentLevel;
    if (!isLevelUp && !isRankUp) return;

    setLevelUpToast({
      show: true,
      level: after.currentLevel,
      rankName: after.rankName,
      isRankUp,
    });
    const timer = setTimeout(
      () => setLevelUpToast((t) => ({ ...t, show: false })),
      4000
    );
    return () => clearTimeout(timer);
  }, [state.xp]);

  /**
   * The server owns the toggle. The client sends intent and reconciles.
   *
   * Three outcomes, and the distinction between them matters:
   *   200 — adopt the server's numbers rather than trusting local arithmetic,
   *         so client and server cannot drift.
   *   409 — another writer got there first. Adopt their state; do *not* roll
   *         back, because the user's intent already holds.
   *   else — a real failure. Roll back everything the optimistic update
   *         touched, including lastCheckIn.
   */
  const runHabitToggle = useCallback(
    async (params: {
      kind: HabitKind;
      id: string;
      completing: boolean;
      prevLastCheckIn: string | null;
    }) => {
      const { kind, id, completing, prevLastCheckIn } = params;
      const listKey = kind === "daily" ? "dailyHabits" : "nonNegotiables";

      try {
        const res = await authedJson("/api/economy/habit/toggle", {
          method: "POST",
          body: JSON.stringify({ kind, id, completing }),
        });

        setState((prev) => ({
          ...prev,
          xp: res.xp,
          streak: res.streak,
          lastCheckIn: res.lastCheckIn,
          [listKey]: prev[listKey].map((h) =>
            h.id === id
              ? { ...h, completedToday: res.habit.completedToday, streak: res.habit.streak }
              : h
          ),
        }));
      } catch (error) {
        if (error instanceof StaleStateError) {
          const s = error.state;
          setState((prev) => ({
            ...prev,
            xp: s?.xp ?? prev.xp,
            streak: s?.streak ?? prev.streak,
            lastCheckIn: s?.lastCheckIn ?? prev.lastCheckIn,
            [listKey]: prev[listKey].map((h) =>
              s?.habit && h.id === id
                ? { ...h, completedToday: s.habit.completedToday, streak: s.habit.streak }
                : h
            ),
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          xp: applyXpDelta(prev.xp, completing ? -xpForHabitKind(kind) : xpForHabitKind(kind)),
          lastCheckIn: prevLastCheckIn,
          [listKey]: prev[listKey].map((h) =>
            h.id === id ? { ...h, completedToday: !completing } : h
          ),
        }));
        showToast("loss", 0, "SYNC_FAILED — reverted");
      } finally {
        pendingToggles.current.delete(id);
      }
    },
    [authedJson, showToast]
  );


  // ── Daily Habits ──

  /**
   * Habit and non-negotiable CRUD, shared by both lists.
   *
   * Titles and rows stay on the browser client under RLS — only the columns
   * that affect rank moved to the server. What changed here is error handling:
   * every one of these used to end in `.then(() => {})`, so a failed write was
   * completely silent. A delete that never reached the database still vanished
   * from the UI and reappeared on the next load.
   */
  const addHabitRow = useCallback(
    async (kind: HabitKind, title: string): Promise<string | null> => {
      if (!userId) return "Not signed in";
      const table = kind === "daily" ? "daily_habits" : "non_negotiables";
      const listKey = kind === "daily" ? "dailyHabits" : "nonNegotiables";
      // randomUUID, not Date.now(): two adds inside the same millisecond
      // produced identical temp ids, and every later edit then targeted both.
      const tempId = crypto.randomUUID();

      setState((prev) => ({
        ...prev,
        [listKey]: [
          ...prev[listKey],
          { id: tempId, title, completedToday: false, streak: 0 },
        ],
      }));

      const { data, error } = await supabase
        .from(table)
        .insert({ user_id: userId, title })
        .select()
        .single();

      if (error || !data) {
        // Remove the optimistic row rather than leaving it stranded with a
        // temp id that matches nothing in the database — the old behaviour,
        // which made every subsequent edit and delete a silent no-op.
        setState((prev) => ({
          ...prev,
          [listKey]: prev[listKey].filter((h) => h.id !== tempId),
        }));
        const message = error?.message ?? "Could not save that.";
        showToast("loss", 0, "SAVE_FAILED — reverted");
        return message;
      }

      setState((prev) => ({
        ...prev,
        [listKey]: prev[listKey].map((h) =>
          h.id === tempId ? { ...h, id: data.id } : h
        ),
      }));
      return null;
    },
    [showToast, userId]
  );

  const editHabitRow = useCallback(
    async (kind: HabitKind, id: string, title: string): Promise<string | null> => {
      if (!userId) return "Not signed in";
      const table = kind === "daily" ? "daily_habits" : "non_negotiables";
      const listKey = kind === "daily" ? "dailyHabits" : "nonNegotiables";

      const previous = (kind === "daily" ? state.dailyHabits : state.nonNegotiables)
        .find((h) => h.id === id)?.title;

      setState((prev) => ({
        ...prev,
        [listKey]: prev[listKey].map((h) => (h.id === id ? { ...h, title } : h)),
      }));

      const { error } = await supabase
        .from(table)
        .update({ title })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        setState((prev) => ({
          ...prev,
          [listKey]: prev[listKey].map((h) =>
            h.id === id && previous !== undefined ? { ...h, title: previous } : h
          ),
        }));
        showToast("loss", 0, "EDIT_FAILED — reverted");
        return error.message;
      }
      return null;
    },
    [showToast, state.dailyHabits, state.nonNegotiables, userId]
  );

  const deleteHabitRow = useCallback(
    async (kind: HabitKind, id: string): Promise<string | null> => {
      if (!userId) return "Not signed in";
      const table = kind === "daily" ? "daily_habits" : "non_negotiables";
      const listKey = kind === "daily" ? "dailyHabits" : "nonNegotiables";

      const removed = (kind === "daily" ? state.dailyHabits : state.nonNegotiables)
        .find((h) => h.id === id);

      setState((prev) => ({
        ...prev,
        [listKey]: prev[listKey].filter((h) => h.id !== id),
      }));

      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        if (removed) {
          setState((prev) => ({ ...prev, [listKey]: [...prev[listKey], removed] }));
        }
        showToast("loss", 0, "DELETE_FAILED — restored");
        return error.message;
      }
      return null;
    },
    [showToast, state.dailyHabits, state.nonNegotiables, userId]
  );

  const addDailyHabit = useCallback(
    (title: string) => addHabitRow("daily", title),
    [addHabitRow]
  );

  const editDailyHabit = useCallback(
    (id: string, title: string) => editHabitRow("daily", id, title),
    [editHabitRow]
  );

  const deleteDailyHabit = useCallback(
    (id: string) => deleteHabitRow("daily", id),
    [deleteHabitRow]
  );

  const toggleDailyHabit = useCallback(
    (id: string) => {
      // Guard: block rapid-fire clicks while DB call is in flight
      if (pendingToggles.current.has(id)) return;

      const habit = state.dailyHabits.find((h) => h.id === id);
      if (!habit) return;

      const completing = !habit.completedToday;
      const { xpDelta } = computeToggle({
        kind: "daily",
        currentXp: state.xp,
        completing,
      });

      pendingToggles.current.add(id);
      // Captured before the optimistic write so a rollback can restore it.
      // Previously the rollback reverted xp and the habit but left
      // lastCheckIn moved, silently corrupting the streak calculation.
      const prevLastCheckIn = state.lastCheckIn;

      // Optimistic update
      setState((prev) => {
        const h = prev.dailyHabits.find((h) => h.id === id);
        if (!h) return prev;
        return {
          ...prev,
          xp: applyXpDelta(prev.xp, xpDelta),
          lastCheckIn: completing ? new Date().toISOString() : prev.lastCheckIn,
          dailyHabits: prev.dailyHabits.map((h) =>
            h.id === id ? { ...h, completedToday: completing } : h
          ),
        };
      });

      if (completing) haptic([40, 30, 40]);
      showToast(
        completing ? "gain" : "loss",
        XP_PER_DAILY_HABIT,
        completing ? `+${XP_PER_DAILY_HABIT} XP` : `-${XP_PER_DAILY_HABIT} XP`
      );

      void runHabitToggle({
        kind: "daily",
        id,
        completing,
        prevLastCheckIn,
      });
    },
    [runHabitToggle, showToast, state.dailyHabits, state.lastCheckIn, state.xp]
  );

  // ── Non-Negotiables ──

  const addNonNegotiable = useCallback(
    (title: string) => addHabitRow("non-negotiable", title),
    [addHabitRow]
  );

  const editNonNegotiable = useCallback(
    (id: string, title: string) => editHabitRow("non-negotiable", id, title),
    [editHabitRow]
  );

  const deleteNonNegotiable = useCallback(
    (id: string) => deleteHabitRow("non-negotiable", id),
    [deleteHabitRow]
  );


  const toggleNonNegotiable = useCallback(
    (id: string) => {
      if (pendingToggles.current.has(id)) return;

      const habit = state.nonNegotiables.find((h) => h.id === id);
      if (!habit) return;

      const completing = !habit.completedToday;
      const { xpDelta } = computeToggle({
        kind: "non-negotiable",
        currentXp: state.xp,
        completing,
      });

      pendingToggles.current.add(id);
      const prevLastCheckIn = state.lastCheckIn;

      // Optimistic update
      setState((prev) => {
        const h = prev.nonNegotiables.find((h) => h.id === id);
        if (!h) return prev;
        return {
          ...prev,
          xp: applyXpDelta(prev.xp, xpDelta),
          lastCheckIn: completing ? new Date().toISOString() : prev.lastCheckIn,
          nonNegotiables: prev.nonNegotiables.map((h) =>
            h.id === id ? { ...h, completedToday: completing } : h
          ),
        };
      });

      if (completing) haptic([60, 40, 60]);
      showToast(
        completing ? "gain" : "loss",
        XP_PER_NON_NEGOTIABLE,
        completing
          ? `+${XP_PER_NON_NEGOTIABLE} XP`
          : `-${XP_PER_NON_NEGOTIABLE} XP`
      );

      void runHabitToggle({
        kind: "non-negotiable",
        id,
        completing,
        prevLastCheckIn,
      });
    },
    [
      runHabitToggle,
      showToast,
      state.lastCheckIn,
      state.nonNegotiables,
      state.xp,
    ]
  );

  // ── Objectives ──

  const addObjective = useCallback(
    async (
      obj: Omit<Objective, "id" | "progress" | "status">
    ): Promise<string | null> => {
      if (!userId) return "Not signed in";
      const tempId = crypto.randomUUID();

      setState((prev) => ({
        ...prev,
        objectives: [
          ...prev.objectives,
          { ...obj, id: tempId, progress: 0, status: "Active" as const },
        ],
      }));

      const { data, error } = await supabase
        .from("objectives")
        .insert({
          user_id: userId,
          type: obj.type,
          title: obj.title,
          description: obj.description,
        })
        .select()
        .single();

      if (error || !data) {
        setState((prev) => ({
          ...prev,
          objectives: prev.objectives.filter((o) => o.id !== tempId),
        }));
        const message = error?.message ?? "Could not save that objective.";
        showToast("loss", 0, "SAVE_FAILED — reverted");
        return message;
      }

      setState((prev) => ({
        ...prev,
        objectives: prev.objectives.map((o) =>
          o.id === tempId ? { ...o, id: data.id } : o
        ),
      }));
      return null;
    },
    [showToast, userId]
  );

  /**
   * Progress is now the server's decision.
   *
   * The client sends an id and nothing else; the step size and the 500/200
   * completion awards live behind the API. A double-tap that previously
   * awarded twice now loses the compare-and-swap and comes back 409, and the
   * loser adopts server truth rather than rolling anything back.
   */
  const incrementObjectiveProgress = useCallback(
    async (id: string): Promise<string | null> => {
      const before = state.objectives.find((o) => o.id === id);
      if (!before || before.status === "Completed") return null;

      try {
        const res = await authedJson("/api/economy/objective/progress", {
          method: "POST",
          body: JSON.stringify({ id }),
        });

        setState((prev) => ({
          ...prev,
          xp: res.xp,
          objectives: prev.objectives.map((o) =>
            o.id === id
              ? { ...o, progress: res.objective.progress, status: res.objective.status }
              : o
          ),
        }));

        if (res.xpAwarded > 0) {
          const label =
            before.type === "north-star"
              ? "NORTH_STAR_ACHIEVED"
              : "SPRINT_COMPLETE";
          showToast("gain", res.xpAwarded, `${label}: +${res.xpAwarded} XP`);
        }
        return null;
      } catch (error) {
        if (error instanceof StaleStateError) {
          const s = error.state;
          setState((prev) => ({
            ...prev,
            xp: s?.xp ?? prev.xp,
            objectives: prev.objectives.map((o) =>
              s?.objective && o.id === id
                ? { ...o, progress: s.objective.progress, status: s.objective.status }
                : o
            ),
          }));
          return null;
        }
        return error instanceof Error ? error.message : "Could not update progress.";
      }
    },
    [authedJson, showToast, state.objectives]
  );

  const editObjective = useCallback(
    async (
      id: string,
      data: { title: string; description: string }
    ): Promise<string | null> => {
      if (!userId) return "Not signed in";
      const previous = state.objectives.find((o) => o.id === id);

      setState((prev) => ({
        ...prev,
        objectives: prev.objectives.map((o) =>
          o.id === id ? { ...o, ...data } : o
        ),
      }));

      const { error } = await supabase
        .from("objectives")
        .update({ title: data.title, description: data.description })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        setState((prev) => ({
          ...prev,
          objectives: prev.objectives.map((o) =>
            o.id === id && previous
              ? { ...o, title: previous.title, description: previous.description }
              : o
          ),
        }));
        showToast("loss", 0, "EDIT_FAILED — reverted");
        return error.message;
      }
      return null;
    },
    [showToast, state.objectives, userId]
  );

  const deleteObjective = useCallback(
    async (id: string): Promise<string | null> => {
      if (!userId) return "Not signed in";
      const removed = state.objectives.find((o) => o.id === id);

      setState((prev) => ({
        ...prev,
        objectives: prev.objectives.filter((o) => o.id !== id),
      }));

      const { error } = await supabase
        .from("objectives")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        if (removed) {
          setState((prev) => ({ ...prev, objectives: [...prev.objectives, removed] }));
        }
        showToast("loss", 0, "DELETE_FAILED — restored");
        return error.message;
      }
      return null;
    },
    [showToast, state.objectives, userId]
  );


  const levelData = getLevelData(state.xp);

  const value: EliteContextValue = {
    ...state,
    loading,
    arenaLoading,
    loadError,
    retryLoad,
    buildMismatch,
    levelData,
    addObjective,
    incrementObjectiveProgress,
    deleteObjective,
    editObjective,
    addDailyHabit,
    editDailyHabit,
    deleteDailyHabit,
    addNonNegotiable,
    editNonNegotiable,
    deleteNonNegotiable,
    toggleDailyHabit,
    toggleNonNegotiable,
    updateUsername,
    sendFriendRequest,
    respondToFriendRequest,
    removeFriend,
    refreshFriendsArena,
    showToast,
  };

  return (
    <EliteContext.Provider value={value}>
      {children}
      <XPToast
        show={toast.show}
        type={toast.type}
        amount={toast.amount}
        message={toast.message}
      />
      <LevelUpToast
        show={levelUpToast.show}
        level={levelUpToast.level}
        rankName={levelUpToast.rankName}
        isRankUp={levelUpToast.isRankUp}
      />
    </EliteContext.Provider>
  );
}
