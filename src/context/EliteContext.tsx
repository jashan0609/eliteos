"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { CheckinType } from "@/components/ProtocolModal";
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

export interface ProtocolLog {
  type: CheckinType;
  answers: Record<string, string | number | boolean>;
  timestamp: string;
}

interface EliteState {
  xp: number;
  streak: number;
  lastCheckIn: string | null;
  initializedAt: string;
  objectives: Objective[];
  logs: ProtocolLog[];
}

interface EliteContextValue extends EliteState {
  updateXP: (amount: number) => void;
  completeProtocol: (
    type: CheckinType,
    answers: Record<string, string | number | boolean>
  ) => void;
  addObjective: (obj: Omit<Objective, "id" | "progress" | "status">) => void;
  incrementObjectiveProgress: (id: string) => void;
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
      "Finish all core modules — Dashboard, Objectives, Ghost Tracker, and Logs — with full mobile responsiveness.",
    progress: 60,
    status: "Active",
  },
];

const DEFAULT_STATE: EliteState = {
  xp: 0,
  streak: 0,
  lastCheckIn: null,
  initializedAt: new Date().toISOString(),
  objectives: SEED_OBJECTIVES,
  logs: [],
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

  // Toast state (lives here so any consumer can trigger via context)
  const [toast, setToast] = useState({
    show: false,
    type: "gain" as "gain" | "loss",
    amount: 0,
    message: "",
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<EliteState>;
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

  const completeProtocol = useCallback(
    (
      type: CheckinType,
      answers: Record<string, string | number | boolean>
    ) => {
      setState((prev) => {
        const today = getToday();
        const yesterday = getYesterday();
        const lastDay = prev.lastCheckIn
          ? prev.lastCheckIn.slice(0, 10)
          : null;

        let newStreak = prev.streak;
        if (lastDay === yesterday) {
          newStreak = prev.streak + 1;
        } else if (lastDay !== today) {
          newStreak = 1;
        }
        // if lastDay === today, keep current streak

        return {
          ...prev,
          xp: prev.xp + 50,
          streak: newStreak,
          lastCheckIn: new Date().toISOString(),
          logs: [
            { type, answers, timestamp: new Date().toISOString() },
            ...prev.logs,
          ],
        };
      });
      showToast("gain", 50, "PROTOCOL_SYNCED");
    },
    [showToast]
  );

  const addObjective = useCallback(
    (obj: Omit<Objective, "id" | "progress" | "status">) => {
      setState((prev) => ({
        ...prev,
        objectives: [
          ...prev.objectives,
          { ...obj, id: Date.now().toString(), progress: 0, status: "Active" },
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
    completeProtocol,
    addObjective,
    incrementObjectiveProgress,
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
