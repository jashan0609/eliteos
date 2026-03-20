"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
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

interface EliteState {
  xp: number;
  streak: number;
  lastCheckIn: string | null;
  lastHabitReset: string | null;
  initializedAt: string;
  objectives: Objective[];
  dailyHabits: Habit[];
  nonNegotiables: Habit[];
}

interface EliteContextValue extends EliteState {
  updateXP: (amount: number) => void;
  addObjective: (obj: Omit<Objective, "id" | "progress" | "status">) => void;
  incrementObjectiveProgress: (id: string) => void;
  addDailyHabit: (title: string) => void;
  addNonNegotiable: (title: string) => void;
  toggleDailyHabit: (id: string) => void;
  toggleNonNegotiable: (id: string) => void;
  showToast: (type: "gain" | "loss", amount: number, message: string) => void;
}

const SEED_OBJECTIVES: Objective[] = [
  {
    id: "1",
    type: "north-star",
    title: "Master Full-Stack Engineering",
    description:
      "Achieve deep proficiency across frontend, backend, databases, and infrastructure. Build and ship 3 production-grade applications.",
    progress: 35,
    status: "Active",
  },
  {
    id: "2",
    type: "sprint",
    title: "Complete EliteOS V1 Prototype",
    description:
      "Finish all core modules — Dashboard, Objectives, Ghost Tracker, and Habits — with full mobile responsiveness.",
    progress: 60,
    status: "Active",
  },
];

const DEFAULT_STATE: EliteState = {
  xp: 0,
  streak: 0,
  lastCheckIn: null,
  lastHabitReset: null,
  initializedAt: new Date().toISOString(),
  objectives: SEED_OBJECTIVES,
  dailyHabits: [],
  nonNegotiables: [],
};

const STORAGE_KEY = "elite-state";

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── Context ──

const EliteContext = createContext<EliteContextValue | null>(null);

export function useElite(): EliteContextValue {
  const ctx = useContext(EliteContext);
  if (!ctx) throw new Error("useElite must be used within EliteProvider");
  return ctx;
}

// ── Provider ──

export function EliteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EliteState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Toast state
  const [toast, setToast] = useState({
    show: false,
    type: "gain" as "gain" | "loss",
    amount: 0,
    message: "",
  });

  // Load from localStorage on mount + daily reset / penalty
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        let saved = JSON.parse(raw) as EliteState;

        // Migration: if old single `habits` array exists, discard it
        const legacy = saved as EliteState & { habits?: unknown };
        if (legacy.habits) {
          const { habits: _, ...rest } = legacy;
          saved = { ...rest, dailyHabits: [], nonNegotiables: [] } as EliteState;
        }
        if (!saved.dailyHabits) saved.dailyHabits = [];
        if (!saved.nonNegotiables) saved.nonNegotiables = [];

        const today = getToday();
        const yesterday = getYesterday();

        // Detect new day — run daily reset & penalty
        const hasItems = saved.dailyHabits.length > 0 || saved.nonNegotiables.length > 0;
        if (saved.lastHabitReset !== today && hasItems) {
          let penalty = 0;

          // Non-negotiables: -60 XP per incomplete
          const updatedNNs = saved.nonNegotiables.map((h) => {
            if (!h.completedToday) penalty += 60;
            const newStreak = h.completedToday ? h.streak + 1 : 0;
            return { ...h, completedToday: false, streak: newStreak };
          });

          // Daily habits: no penalty, just reset
          const updatedDaily = saved.dailyHabits.map((h) => {
            const newStreak = h.completedToday ? h.streak + 1 : 0;
            return { ...h, completedToday: false, streak: newStreak };
          });

          // Global streak
          const lastDay = saved.lastCheckIn
            ? saved.lastCheckIn.slice(0, 10)
            : null;
          let newStreak = saved.streak;
          if (lastDay === yesterday) {
            newStreak = saved.streak + 1;
          } else if (lastDay !== today) {
            newStreak = lastDay ? 0 : saved.streak;
          }

          saved = {
            ...saved,
            nonNegotiables: updatedNNs,
            dailyHabits: updatedDaily,
            xp: Math.max(0, saved.xp - penalty),
            streak: newStreak,
            lastHabitReset: today,
          };

          if (penalty > 0) {
            setTimeout(() => {
              setToast({
                show: true,
                type: "loss",
                amount: penalty,
                message: "NON-NEGOTIABLE PENALTY",
              });
              setTimeout(
                () => setToast((t) => ({ ...t, show: false })),
                3000
              );
            }, 500);
          }
        }

        setState((prev) => ({ ...prev, ...saved }));
      }
    } catch {
      // ignore corrupt data
    }
    setHydrated(true);
  }, []);

  // Save to localStorage on every state change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const showToast = useCallback(
    (type: "gain" | "loss", amount: number, message: string) => {
      setToast({ show: true, type, amount, message });
      setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
    },
    []
  );

  const updateXP = useCallback(
    (amount: number) => {
      setState((prev) => ({ ...prev, xp: Math.max(0, prev.xp + amount) }));
      if (amount > 0) {
        showToast("gain", amount, `+${amount} XP`);
      } else if (amount < 0) {
        showToast("loss", Math.abs(amount), `${amount} XP`);
      }
    },
    [showToast]
  );

  // ── Daily Habits ──

  const addDailyHabit = useCallback((title: string) => {
    setState((prev) => ({
      ...prev,
      dailyHabits: [
        ...prev.dailyHabits,
        { id: Date.now().toString(), title, completedToday: false, streak: 0 },
      ],
    }));
  }, []);

  const toggleDailyHabit = useCallback(
    (id: string) => {
      setState((prev) => {
        const habit = prev.dailyHabits.find((h) => h.id === id);
        if (!habit) return prev;

        const completing = !habit.completedToday;
        const xpDelta = completing ? 15 : -15;

        return {
          ...prev,
          xp: Math.max(0, prev.xp + xpDelta),
          lastCheckIn: completing
            ? new Date().toISOString()
            : prev.lastCheckIn,
          dailyHabits: prev.dailyHabits.map((h) =>
            h.id === id ? { ...h, completedToday: !h.completedToday } : h
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
    [showToast, state.dailyHabits]
  );

  // ── Non-Negotiables ──

  const addNonNegotiable = useCallback((title: string) => {
    setState((prev) => ({
      ...prev,
      nonNegotiables: [
        ...prev.nonNegotiables,
        { id: Date.now().toString(), title, completedToday: false, streak: 0 },
      ],
    }));
  }, []);

  const toggleNonNegotiable = useCallback(
    (id: string) => {
      setState((prev) => {
        const habit = prev.nonNegotiables.find((h) => h.id === id);
        if (!habit) return prev;

        const completing = !habit.completedToday;
        const xpDelta = completing ? 30 : -30;

        return {
          ...prev,
          xp: Math.max(0, prev.xp + xpDelta),
          lastCheckIn: completing
            ? new Date().toISOString()
            : prev.lastCheckIn,
          nonNegotiables: prev.nonNegotiables.map((h) =>
            h.id === id ? { ...h, completedToday: !h.completedToday } : h
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
    [showToast, state.nonNegotiables]
  );

  // ── Objectives ──

  const addObjective = useCallback(
    (obj: Omit<Objective, "id" | "progress" | "status">) => {
      setState((prev) => ({
        ...prev,
        objectives: [
          ...prev.objectives,
          {
            ...obj,
            id: Date.now().toString(),
            progress: 0,
            status: "Active",
          },
        ],
      }));
    },
    []
  );

  const incrementObjectiveProgress = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      objectives: prev.objectives.map((o) => {
        if (o.id !== id) return o;
        const next = Math.min(o.progress + 10, 100);
        return {
          ...o,
          progress: next,
          status: next === 100 ? "Completed" : o.status,
        };
      }),
    }));
  }, []);

  const value: EliteContextValue = {
    ...state,
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
