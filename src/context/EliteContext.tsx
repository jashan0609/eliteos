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
import { supabase } from "@/lib/supabase";
import {
  buildResetPlan,
  getUpdatedGlobalStreak,
  toDateStr,
  type ResettableHabit,
} from "@/lib/daily-reset";
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
  levelData: LevelData;
  updateXP: (amount: number) => void;
  addObjective: (obj: Omit<Objective, "id" | "progress" | "status">) => void;
  incrementObjectiveProgress: (id: string) => void;
  deleteObjective: (id: string) => void;
  editObjective: (id: string, data: { title: string; description: string }) => void;
  addDailyHabit: (title: string) => void;
  editDailyHabit: (id: string, title: string) => void;
  deleteDailyHabit: (id: string) => void;
  addNonNegotiable: (title: string) => void;
  editNonNegotiable: (id: string, title: string) => void;
  deleteNonNegotiable: (id: string) => void;
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

// ── Haptic feedback (mobile only) ──

function haptic(pattern: number | number[] = 30) {
  // navigator.vibrate is Android Chrome only — iOS Safari does not support it
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

// ── Helper: update profile column(s) ──

async function patchProfile(
  userId: string,
  fields: Record<string, unknown>
) {
  await supabase.from("operator_profile").update(fields).eq("id", userId);
}

// ── Provider ──

export function EliteProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [state, setState] = useState<EliteState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [arenaLoading, setArenaLoading] = useState(false);

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

  // ── Fetch all data from Supabase on login ──
  useEffect(() => {
    let cancelled = false;

    if (!user) {
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
      if (!cancelled) setLoading(true);
    });

    async function fetchSystemState() {
      const userId = user!.id;

      // Fetch all tables in parallel
      const [profileRes, objRes, dhRes, nnRes, logsRes] = await Promise.all([
        supabase.from("operator_profile").select("*").eq("id", userId).single(),
        supabase.from("objectives").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("daily_habits").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("non_negotiables").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("daily_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      // If no profile yet, create one (first login)
      let profile = profileRes.data;
      if (!profile) {
        const signupUsername =
          typeof user?.user_metadata?.username === "string"
            ? user.user_metadata.username.toLowerCase()
            : null;
        const { data: newProfile } = await supabase
          .from("operator_profile")
          .insert({ id: userId, ...(signupUsername ? { username: signupUsername } : {}) })
          .select()
          .single();
        profile = newProfile;
      }

      if (!profile || cancelled) return;

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (profile.timezone !== userTimezone) {
        // Keep timezone fresh so both login recovery and cron align
        // to the user's local day boundary.
        await supabase
          .from("operator_profile")
          .update({ timezone: userTimezone })
          .eq("id", userId);
        profile = { ...profile, timezone: userTimezone };
      }

      let dailyHabitRows = (dhRes.data ?? []) as ResettableHabit[];
      let nonNegotiableRows = (nnRes.data ?? []) as ResettableHabit[];
      let logRows = logsRes.data ?? [];

      const today = toDateStr(new Date(), userTimezone);

      if (profile.last_habit_reset !== today) {
        const resetPlan = buildResetPlan({
          today,
          lastHabitReset: profile.last_habit_reset,
          xp: profile.xp,
          nonNegotiables: nonNegotiableRows,
          dailyHabits: dailyHabitRows,
        });

        for (const day of resetPlan.days) {
          const { data: insertedLog } = await supabase
            .from("daily_logs")
            .insert({
              user_id: userId,
              date: day.date,
              nn_summary: day.nnSummary,
              habit_summary: day.habitSummary,
              total_xp_at_time: day.xpAtTime,
              penalty: day.penalty,
            })
            .select()
            .single();

          if (insertedLog) {
            logRows = [insertedLog, ...logRows];
          }
        }

        const updatedNonNegotiables = nonNegotiableRows.map((habit) => ({
          ...habit,
          completed_today: false,
          streak: habit.completed_today ? habit.streak + 1 : 0,
        }));
        const updatedDailyHabits = dailyHabitRows.map((habit) => ({
          ...habit,
          completed_today: false,
          streak: habit.completed_today ? habit.streak + 1 : 0,
        }));

        await Promise.all([
          ...updatedNonNegotiables.map((habit) =>
            supabase
              .from("non_negotiables")
              .update({
                completed_today: false,
                streak: habit.streak,
              })
              .eq("id", habit.id)
          ),
          ...updatedDailyHabits.map((habit) =>
            supabase
              .from("daily_habits")
              .update({
                completed_today: false,
                streak: habit.streak,
              })
              .eq("id", habit.id)
          ),
        ]);

        const yesterday = toDateStr(
          new Date(Date.now() - 86_400_000),
          userTimezone
        );
        const newGlobalStreak = getUpdatedGlobalStreak({
          streak: profile.streak,
          lastCheckIn: profile.last_check_in,
          timezone: userTimezone,
          today,
          yesterday,
        });

        await supabase
          .from("operator_profile")
          .update({
            xp: resetPlan.finalXp,
            streak: newGlobalStreak,
            last_habit_reset: today,
            timezone: userTimezone,
          })
          .eq("id", userId);

        profile = {
          ...profile,
          xp: resetPlan.finalXp,
          streak: newGlobalStreak,
          last_habit_reset: today,
          timezone: userTimezone,
        };
        dailyHabitRows = updatedDailyHabits;
        nonNegotiableRows = updatedNonNegotiables;
      }

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

      if (!cancelled) {
        setState(loadedState);
        setLoading(false);
      }
    }

    fetchSystemState();
    return () => { cancelled = true; };
  }, [user]);

  const authedJson = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!session?.access_token) throw new Error("Not authenticated");
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(init?.headers ?? {}),
        },
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? "Request failed");
      }
      return data;
    },
    [session?.access_token]
  );

  const refreshFriendsArena = useCallback(async (silent = false) => {
    if (!user || !session?.access_token) {
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
  }, [authedJson, session?.access_token, user]);

  useEffect(() => {
    if (!user || loading) return;
    refreshFriendsArena();
  }, [loading, refreshFriendsArena, state.logs.length, state.streak, user]);

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
      if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
        return "Username must be 3-24 chars: lowercase letters, numbers, underscore.";
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

  // ── XP ──

  const updateXP = useCallback(
    (amount: number) => {
      setState((prev) => {
        const oldData = getLevelData(prev.xp);
        const newXp = Math.max(0, prev.xp + amount);
        const newData = getLevelData(newXp);

        if (amount > 0) {
          const isRankUp = newData.rankName !== oldData.rankName;
          const isLevelUp = newData.currentLevel > oldData.currentLevel;
          if (isLevelUp || isRankUp) {
            setLevelUpToast({
              show: true,
              level: newData.currentLevel,
              rankName: newData.rankName,
              isRankUp,
            });
            setTimeout(
              () => setLevelUpToast((t) => ({ ...t, show: false })),
              4000
            );
          }
        }

        if (user) patchProfile(user.id, { xp: newXp });
        return { ...prev, xp: newXp };
      });
      if (amount > 0) {
        showToast("gain", amount, `+${amount} XP`);
      } else if (amount < 0) {
        showToast("loss", Math.abs(amount), `${amount} XP`);
      }
    },
    [showToast, user]
  );

  // ── Daily Habits ──

  const addDailyHabit = useCallback(
    (title: string) => {
      if (!user) return;
      const tempId = Date.now().toString();

      setState((prev) => ({
        ...prev,
        dailyHabits: [
          ...prev.dailyHabits,
          { id: tempId, title, completedToday: false, streak: 0 },
        ],
      }));

      // Insert to Supabase and update local ID
      supabase
        .from("daily_habits")
        .insert({ user_id: user.id, title })
        .select()
        .single()
        .then(({ data }) => {
          if (data) {
            setState((prev) => ({
              ...prev,
              dailyHabits: prev.dailyHabits.map((h) =>
                h.id === tempId ? { ...h, id: data.id } : h
              ),
            }));
          }
        });
    },
    [user]
  );

  const editDailyHabit = useCallback(
    (id: string, title: string) => {
      if (!user) return;
      setState((prev) => ({
        ...prev,
        dailyHabits: prev.dailyHabits.map((h) => h.id === id ? { ...h, title } : h),
      }));
      supabase.from("daily_habits").update({ title }).eq("id", id).then(() => {});
    },
    [user]
  );

  const deleteDailyHabit = useCallback(
    (id: string) => {
      if (!user) return;
      setState((prev) => ({ ...prev, dailyHabits: prev.dailyHabits.filter((h) => h.id !== id) }));
      supabase.from("daily_habits").delete().eq("id", id).then(() => {});
    },
    [user]
  );

  const toggleDailyHabit = useCallback(
    (id: string) => {
      // Guard: block rapid-fire clicks while DB call is in flight
      if (pendingToggles.current.has(id)) return;

      const habit = state.dailyHabits.find((h) => h.id === id);
      if (!habit) return;

      const completing = !habit.completedToday;
      const xpDelta = completing ? 15 : -15;

      pendingToggles.current.add(id);

      // Optimistic update
      setState((prev) => {
        const h = prev.dailyHabits.find((h) => h.id === id);
        if (!h) return prev;
        const newXp = Math.max(0, prev.xp + xpDelta);
        return {
          ...prev,
          xp: newXp,
          lastCheckIn: completing ? new Date().toISOString() : prev.lastCheckIn,
          dailyHabits: prev.dailyHabits.map((h) =>
            h.id === id ? { ...h, completedToday: completing } : h
          ),
        };
      });

      if (completing) haptic([40, 30, 40]);
      showToast(completing ? "gain" : "loss", 15, completing ? "+15 XP" : "-15 XP");

      // Persist to DB — rollback on failure
      if (user) {
        Promise.all([
          supabase.from("daily_habits").update({ completed_today: completing }).eq("id", id),
          supabase.from("operator_profile").update({
            xp: Math.max(0, state.xp + xpDelta),
            ...(completing ? { last_check_in: new Date().toISOString() } : {}),
          }).eq("id", user.id),
        ]).then(([habitRes, profileRes]) => {
          pendingToggles.current.delete(id);
          if (habitRes.error || profileRes.error) {
            setState((prev) => ({
              ...prev,
              xp: Math.max(0, prev.xp - xpDelta),
              dailyHabits: prev.dailyHabits.map((h) =>
                h.id === id ? { ...h, completedToday: !completing } : h
              ),
            }));
            showToast("loss", 0, "SYNC_FAILED — reverted");
          }
        });
      } else {
        pendingToggles.current.delete(id);
      }
    },
    [showToast, state.dailyHabits, state.xp, user]
  );

  // ── Non-Negotiables ──

  const addNonNegotiable = useCallback(
    (title: string) => {
      if (!user) return;
      const tempId = Date.now().toString();

      setState((prev) => ({
        ...prev,
        nonNegotiables: [
          ...prev.nonNegotiables,
          { id: tempId, title, completedToday: false, streak: 0 },
        ],
      }));

      supabase
        .from("non_negotiables")
        .insert({ user_id: user.id, title })
        .select()
        .single()
        .then(({ data }) => {
          if (data) {
            setState((prev) => ({
              ...prev,
              nonNegotiables: prev.nonNegotiables.map((h) =>
                h.id === tempId ? { ...h, id: data.id } : h
              ),
            }));
          }
        });
    },
    [user]
  );

  const editNonNegotiable = useCallback(
    (id: string, title: string) => {
      if (!user) return;
      setState((prev) => ({
        ...prev,
        nonNegotiables: prev.nonNegotiables.map((h) => h.id === id ? { ...h, title } : h),
      }));
      supabase.from("non_negotiables").update({ title }).eq("id", id).then(() => {});
    },
    [user]
  );

  const deleteNonNegotiable = useCallback(
    (id: string) => {
      if (!user) return;
      setState((prev) => ({ ...prev, nonNegotiables: prev.nonNegotiables.filter((h) => h.id !== id) }));
      supabase.from("non_negotiables").delete().eq("id", id).then(() => {});
    },
    [user]
  );

  const toggleNonNegotiable = useCallback(
    (id: string) => {
      if (pendingToggles.current.has(id)) return;

      const habit = state.nonNegotiables.find((h) => h.id === id);
      if (!habit) return;

      const completing = !habit.completedToday;
      const xpDelta = completing ? 30 : -30;

      pendingToggles.current.add(id);

      // Optimistic update
      setState((prev) => {
        const h = prev.nonNegotiables.find((h) => h.id === id);
        if (!h) return prev;
        const newXp = Math.max(0, prev.xp + xpDelta);
        return {
          ...prev,
          xp: newXp,
          lastCheckIn: completing ? new Date().toISOString() : prev.lastCheckIn,
          nonNegotiables: prev.nonNegotiables.map((h) =>
            h.id === id ? { ...h, completedToday: completing } : h
          ),
        };
      });

      if (completing) haptic([60, 40, 60]);
      showToast(completing ? "gain" : "loss", 30, completing ? "+30 XP" : "-30 XP");

      // Persist to DB — rollback on failure
      if (user) {
        Promise.all([
          supabase.from("non_negotiables").update({ completed_today: completing }).eq("id", id),
          supabase.from("operator_profile").update({
            xp: Math.max(0, state.xp + xpDelta),
            ...(completing ? { last_check_in: new Date().toISOString() } : {}),
          }).eq("id", user.id),
        ]).then(([habitRes, profileRes]) => {
          pendingToggles.current.delete(id);
          if (habitRes.error || profileRes.error) {
            setState((prev) => ({
              ...prev,
              xp: Math.max(0, prev.xp - xpDelta),
              nonNegotiables: prev.nonNegotiables.map((h) =>
                h.id === id ? { ...h, completedToday: !completing } : h
              ),
            }));
            showToast("loss", 0, "SYNC_FAILED — reverted");
          }
        });
      } else {
        pendingToggles.current.delete(id);
      }
    },
    [showToast, state.nonNegotiables, state.xp, user]
  );

  // ── Objectives ──

  const addObjective = useCallback(
    (obj: Omit<Objective, "id" | "progress" | "status">) => {
      if (!user) return;
      const tempId = Date.now().toString();

      setState((prev) => ({
        ...prev,
        objectives: [
          ...prev.objectives,
          { ...obj, id: tempId, progress: 0, status: "Active" as const },
        ],
      }));

      supabase
        .from("objectives")
        .insert({ user_id: user.id, type: obj.type, title: obj.title, description: obj.description })
        .select()
        .single()
        .then(({ data }) => {
          if (data) {
            setState((prev) => ({
              ...prev,
              objectives: prev.objectives.map((o) =>
                o.id === tempId ? { ...o, id: data.id } : o
              ),
            }));
          }
        });
    },
    [user]
  );

  const incrementObjectiveProgress = useCallback(
    (id: string) => {
      setState((prev) => {
        const obj = prev.objectives.find((o) => o.id === id);
        if (!obj || obj.status === "Completed") return prev;

        const next = Math.min(obj.progress + 10, 100);
        const justCompleted = next === 100 && obj.status === "Active";
        const xpReward = justCompleted
          ? obj.type === "north-star"
            ? 500
            : 200
          : 0;
        const newXp = prev.xp + xpReward;

        // Async DB update
        if (user) {
          supabase
            .from("objectives")
            .update({
              progress: next,
              ...(justCompleted ? { status: "Completed" } : {}),
            })
            .eq("id", id)
            .then(() => {});
          if (xpReward > 0) {
            patchProfile(user.id, { xp: newXp });
          }
        }

        return {
          ...prev,
          xp: newXp,
          objectives: prev.objectives.map((o) =>
            o.id === id
              ? {
                  ...o,
                  progress: next,
                  status: justCompleted ? ("Completed" as const) : o.status,
                }
              : o
          ),
        };
      });

      // Toast
      const obj = state.objectives.find((o) => o.id === id);
      if (obj && obj.status === "Active") {
        const next = Math.min(obj.progress + 10, 100);
        if (next === 100) {
          const reward = obj.type === "north-star" ? 500 : 200;
          const label =
            obj.type === "north-star"
              ? "NORTH_STAR_ACHIEVED"
              : "SPRINT_COMPLETE";
          showToast("gain", reward, `${label}: +${reward} XP`);
        }
      }
    },
    [showToast, state.objectives, user]
  );

  const editObjective = useCallback(
    (id: string, data: { title: string; description: string }) => {
      if (!user) return;
      setState((prev) => ({
        ...prev,
        objectives: prev.objectives.map((o) => o.id === id ? { ...o, ...data } : o),
      }));
      supabase.from("objectives").update({ title: data.title, description: data.description }).eq("id", id).then(() => {});
    },
    [user]
  );

  const deleteObjective = useCallback(
    (id: string) => {
      if (!user) return;
      setState((prev) => ({ ...prev, objectives: prev.objectives.filter((o) => o.id !== id) }));
      supabase.from("objectives").delete().eq("id", id).then(() => {});
    },
    [user]
  );

  const levelData = getLevelData(state.xp);

  const value: EliteContextValue = {
    ...state,
    loading,
    arenaLoading,
    levelData,
    updateXP,
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
