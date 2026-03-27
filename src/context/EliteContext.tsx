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
  initializedAt: string;
  objectives: Objective[];
  dailyHabits: Habit[];
  nonNegotiables: Habit[];
  logs: DailyPerformanceLog[];
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
  levelData: LevelData;
  updateXP: (amount: number) => void;
  addObjective: (obj: Omit<Objective, "id" | "progress" | "status">) => void;
  incrementObjectiveProgress: (id: string) => void;
  addDailyHabit: (title: string) => void;
  addNonNegotiable: (title: string) => void;
  toggleDailyHabit: (id: string) => void;
  toggleNonNegotiable: (id: string) => void;
  showToast: (type: "gain" | "loss", amount: number, message: string) => void;
}

const DEFAULT_STATE: EliteState = {
  xp: 0,
  streak: 0,
  lastCheckIn: null,
  lastHabitReset: null,
  initializedAt: new Date().toISOString(),
  objectives: [],
  dailyHabits: [],
  nonNegotiables: [],
  logs: [],
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
  const { user } = useAuth();
  const [state, setState] = useState<EliteState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

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
    if (!user) {
      setState(DEFAULT_STATE);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchSystemState() {
      const userId = user!.id;

      // Debug: verify auth session is attached
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("[ELITE_DEBUG] session:", sessionData.session ? "VALID" : "NULL");
      console.log("[ELITE_DEBUG] user_id:", userId);

      // Fetch all tables in parallel
      const [profileRes, objRes, dhRes, nnRes, logsRes] = await Promise.all([
        supabase.from("operator_profile").select("*").eq("id", userId).single(),
        supabase.from("objectives").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("daily_habits").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("non_negotiables").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("daily_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      // Debug: log any errors
      console.log("[ELITE_DEBUG] profile:", profileRes.error?.message ?? "OK");
      console.log("[ELITE_DEBUG] objectives:", objRes.error?.message ?? "OK");
      console.log("[ELITE_DEBUG] habits:", dhRes.error?.message ?? "OK");

      // If no profile yet, create one (first login)
      let profile = profileRes.data;
      if (!profile) {
        const { data: newProfile } = await supabase
          .from("operator_profile")
          .insert({ id: userId })
          .select()
          .single();
        profile = newProfile;
      }

      if (!profile || cancelled) return;

      // Map DB rows to local types
      const objectives: Objective[] = (objRes.data ?? []).map((r) => ({
        id: r.id,
        type: r.type as "north-star" | "sprint",
        title: r.title,
        description: r.description,
        progress: r.progress,
        status: r.status as "Active" | "Completed",
      }));

      const dailyHabits: Habit[] = (dhRes.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        completedToday: r.completed_today,
        streak: r.streak,
      }));

      const nonNegotiables: Habit[] = (nnRes.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        completedToday: r.completed_today,
        streak: r.streak,
      }));

      const logs: DailyPerformanceLog[] = (logsRes.data ?? []).map((r) => ({
        date: r.date,
        nnSummary: r.nn_summary as { title: string; completed: boolean }[],
        habitSummary: r.habit_summary as { title: string; completed: boolean }[],
        totalXpAtTime: r.total_xp_at_time,
        penalty: r.penalty,
      }));

      // ── Client-side streak computation ──
      // Streak increments when the user opens the app on a new day (after midnight)
      // AND they completed at least one habit/NN the previous day.
      // last_check_in is set whenever a habit/NN is toggled on.
      // last_habit_reset tracks the last day the cron (or client) processed the day rollover.
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const lastCheckInDay = profile.last_check_in
        ? profile.last_check_in.slice(0, 10)
        : null;
      const lastResetDay = profile.last_habit_reset ?? null;

      let computedStreak = profile.streak;

      // Only recompute if we haven't already processed today
      if (lastResetDay !== todayStr) {
        if (lastCheckInDay === yesterdayStr) {
          // User completed something yesterday → streak continues
          computedStreak = profile.streak + 1;
        } else if (lastCheckInDay === todayStr) {
          // User already checked in today, streak unchanged
          computedStreak = profile.streak;
        } else {
          // Missed yesterday entirely → streak breaks
          computedStreak = lastCheckInDay ? 0 : profile.streak;
        }
      }

      // Detect user's local timezone from browser
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Persist streak change, mark today as processed, and save timezone
      if (lastResetDay !== todayStr) {
        await supabase
          .from("operator_profile")
          .update({ streak: computedStreak, last_habit_reset: todayStr, timezone: userTimezone })
          .eq("id", userId);
      } else {
        // Always keep timezone up to date even if streak didn't change
        await supabase
          .from("operator_profile")
          .update({ timezone: userTimezone })
          .eq("id", userId);
      }

      const loadedState: EliteState = {
        xp: profile.xp,
        streak: computedStreak,
        lastCheckIn: profile.last_check_in,
        lastHabitReset: profile.last_habit_reset,
        initializedAt: profile.initialized_at,
        objectives,
        dailyHabits,
        nonNegotiables,
        logs,
      };

      if (!cancelled) {
        setState(loadedState);
        setLoading(false);
      }
    }

    fetchSystemState();
    return () => { cancelled = true; };
  }, [user]);

  const showToast = useCallback(
    (type: "gain" | "loss", amount: number, message: string) => {
      setToast({ show: true, type, amount, message });
      setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
    },
    []
  );

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

  const levelData = getLevelData(state.xp);

  const value: EliteContextValue = {
    ...state,
    loading,
    levelData,
    updateXP,
    addObjective,
    incrementObjectiveProgress,
    addDailyHabit,
    addNonNegotiable,
    toggleDailyHabit,
    toggleNonNegotiable,
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
