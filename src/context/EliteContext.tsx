"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import XPToast from "@/components/XPToast";

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

interface EliteContextValue extends EliteState {
  loading: boolean;
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

  // Toast state
  const [toast, setToast] = useState({
    show: false,
    type: "gain" as "gain" | "loss",
    amount: 0,
    message: "",
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

      const loadedState: EliteState = {
        xp: profile.xp,
        streak: profile.streak,
        lastCheckIn: profile.last_check_in,
        lastHabitReset: profile.last_habit_reset,
        initializedAt: profile.initialized_at,
        objectives,
        dailyHabits,
        nonNegotiables,
        logs,
      };

      // Daily reset is handled server-side by the daily-reset Edge Function.
      // The context simply trusts the database state.

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
        const newXp = Math.max(0, prev.xp + amount);
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
      setState((prev) => {
        const habit = prev.dailyHabits.find((h) => h.id === id);
        if (!habit) return prev;

        const completing = !habit.completedToday;
        const xpDelta = completing ? 15 : -15;
        const newXp = Math.max(0, prev.xp + xpDelta);

        // Async DB updates
        if (user) {
          supabase
            .from("daily_habits")
            .update({ completed_today: completing })
            .eq("id", id);
          patchProfile(user.id, {
            xp: newXp,
            ...(completing ? { last_check_in: new Date().toISOString() } : {}),
          });
        }

        return {
          ...prev,
          xp: newXp,
          lastCheckIn: completing ? new Date().toISOString() : prev.lastCheckIn,
          dailyHabits: prev.dailyHabits.map((h) =>
            h.id === id ? { ...h, completedToday: completing } : h
          ),
        };
      });

      const habit = state.dailyHabits.find((h) => h.id === id);
      if (habit) {
        if (!habit.completedToday) {
          showToast("gain", 15, "+15 XP");
        } else {
          showToast("loss", 15, "-15 XP");
        }
      }
    },
    [showToast, state.dailyHabits, user]
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
      setState((prev) => {
        const habit = prev.nonNegotiables.find((h) => h.id === id);
        if (!habit) return prev;

        const completing = !habit.completedToday;
        const xpDelta = completing ? 30 : -30;
        const newXp = Math.max(0, prev.xp + xpDelta);

        if (user) {
          supabase
            .from("non_negotiables")
            .update({ completed_today: completing })
            .eq("id", id);
          patchProfile(user.id, {
            xp: newXp,
            ...(completing ? { last_check_in: new Date().toISOString() } : {}),
          });
        }

        return {
          ...prev,
          xp: newXp,
          lastCheckIn: completing ? new Date().toISOString() : prev.lastCheckIn,
          nonNegotiables: prev.nonNegotiables.map((h) =>
            h.id === id ? { ...h, completedToday: completing } : h
          ),
        };
      });

      const habit = state.nonNegotiables.find((h) => h.id === id);
      if (habit) {
        if (!habit.completedToday) {
          showToast("gain", 30, "+30 XP");
        } else {
          showToast("loss", 30, "-30 XP");
        }
      }
    },
    [showToast, state.nonNegotiables, user]
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
            .eq("id", id);
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

  const value: EliteContextValue = {
    ...state,
    loading,
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
    </EliteContext.Provider>
  );
}
