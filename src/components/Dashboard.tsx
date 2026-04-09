"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Target,
  Ghost,
  CheckCircle,
  ShieldAlert,
  BookOpen,
  Skull,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function AuraTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "#0a0a0a",
        border: "1px solid rgba(139,92,246,0.4)",
        borderRadius: "0.5rem",
        padding: "8px 12px",
        fontFamily: "monospace",
      }}
    >
      <p style={{ color: "#888", fontSize: "10px", marginBottom: "4px", letterSpacing: "0.1em" }}>
        {label}
      </p>
      <p style={{ color: "#8b5cf6", fontSize: "13px", fontWeight: 700 }}>
        {(payload[0].value ?? 0).toLocaleString()} XP
      </p>
    </div>
  );
}
import type { TabId } from "@/app/page";
import { useElite } from "@/context/EliteContext";
import ObjectivesView from "./ObjectivesView";
import HabitsView from "./HabitsView";
import LogsView from "./LogsView";

const TAB_CONTENT: Record<
  TabId,
  { title: string; subtitle: string; icon: typeof Zap; accent: string }
> = {
  dashboard: {
    title: "Your Protocol",
    subtitle: "Overview of your goals and activity",
    icon: Zap,
    accent: "text-violet",
  },
  objectives: {
    title: "Goals",
    subtitle: "Track your objectives, milestones, and key results",
    icon: Target,
    accent: "text-cyan",
  },
  ghost: {
    title: "The Arena",
    subtitle: "See how you stack up — rival heatmaps and benchmarks",
    icon: Ghost,
    accent: "text-pink",
  },
  habits: {
    title: "Habits",
    subtitle: "Non-negotiables and daily disciplines",
    icon: CheckCircle,
    accent: "text-cyan",
  },
  logs: {
    title: "System Logs",
    subtitle: "Daily performance archive and history",
    icon: BookOpen,
    accent: "text-muted",
  },
};

interface DashboardProps {
  activeTab: TabId;
}

export default function Dashboard({ activeTab }: DashboardProps) {
  const { objectives, dailyHabits, nonNegotiables, logs } = useElite();
  const tab = TAB_CONTENT[activeTab];
  const TabIcon = tab.icon;

  // Chart data: last 7 days of XP from logs
  const chartData = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const sorted = [...logs]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
    return sorted.map((log) => {
      const d = new Date(log.date + "T00:00:00");
      return { day: dayNames[d.getDay()], xp: log.totalXpAtTime };
    });
  }, [logs]);

  // Total wasted XP from penalties across all logs
  const totalWasted = useMemo(
    () => logs.reduce((sum, log) => sum + log.penalty, 0),
    [logs]
  );

  // Derive stats
  const completedObjectives = objectives.filter(
    (o) => o.status === "Completed"
  ).length;
  const totalObjectives = objectives.length;

  const completedDaily = dailyHabits.filter((h) => h.completedToday).length;
  const totalDaily = dailyHabits.length;

  const completedNNs = nonNegotiables.filter((h) => h.completedToday).length;
  const totalNNs = nonNegotiables.length;

  // Today's XP earned from habits
  const xpToday = completedDaily * 15 + completedNNs * 30;

  return (
    <div className="flex-1 p-4 md:p-6 overflow-auto pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {/* Tab Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <TabIcon
                size={22}
                strokeWidth={1.5}
                className={tab.accent}
              />
              <h1 className="text-xl md:text-2xl font-bold text-text tracking-tight">
                {tab.title}
              </h1>
            </div>
            <p className="text-sm text-muted ml-9">{tab.subtitle}</p>
          </div>

          {/* ═══ DASHBOARD TAB ═══ */}
          {activeTab === "dashboard" && (
            <>
              {/* System Telemetry Chart — top of dashboard */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.35 }}
                className="glass p-4 md:p-5 mb-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                    System Telemetry
                  </h3>
                  <span className="text-[10px] text-dim font-mono">XP_TREND · 7D</span>
                </div>
                {chartData.length > 0 ? (
                  <div className="w-full h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid
                          strokeDasharray="2 4"
                          stroke="rgba(255,255,255,0.04)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tick={{ fill: "#555", fontSize: 10, fontFamily: "monospace" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#555", fontSize: 10, fontFamily: "monospace" }}
                          axisLine={false}
                          tickLine={false}
                          width={38}
                        />
                        <Tooltip content={<AuraTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="xp"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dot={{ fill: "#8b5cf6", r: 3, strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: "#8b5cf6", strokeWidth: 2, stroke: "rgba(139,92,246,0.3)" }}
                          style={{ filter: "drop-shadow(0 0 4px rgba(139,92,246,0.7)) drop-shadow(0 0 10px rgba(139,92,246,0.3))" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-44 flex items-center justify-center border border-dashed border-card-border rounded-xl">
                    <p className="text-[11px] text-dim font-mono tracking-wider">
                      INSUFFICIENT_DATA_FOR_TELEMETRY
                    </p>
                  </div>
                )}
              </motion.div>

              {/* Activity Cards */}
              <div className="mb-6">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-3">
                  Activity
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Goal Progress */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.35 }}
                    className="glass glass-hover p-4 md:p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-xl bg-card-border/30">
                        <Target
                          size={18}
                          strokeWidth={1.5}
                          className="text-muted"
                        />
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          completedObjectives === totalObjectives &&
                          totalObjectives > 0
                            ? "text-cyan"
                            : totalObjectives > 0
                              ? "text-violet"
                              : "text-dim"
                        }`}
                      >
                        {totalObjectives === 0
                          ? "None"
                          : completedObjectives === totalObjectives
                            ? "Complete"
                            : "In Progress"}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-text mb-1">
                      Goal Progress
                    </h3>
                    <p className="text-xs text-muted">
                      {completedObjectives} of {totalObjectives} objectives done
                    </p>
                  </motion.div>

                  {/* Critical Protocol (Non-Negotiables) */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.14, duration: 0.35 }}
                    className="glass glass-hover p-4 md:p-5 border border-pink/10"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-xl bg-pink/10">
                        <ShieldAlert
                          size={18}
                          strokeWidth={1.5}
                          className="text-pink"
                        />
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          completedNNs === totalNNs && totalNNs > 0
                            ? "text-cyan"
                            : totalNNs > 0
                              ? "text-pink"
                              : "text-dim"
                        }`}
                      >
                        {totalNNs === 0
                          ? "None Set"
                          : completedNNs === totalNNs
                            ? "Locked In"
                            : `${completedNNs}/${totalNNs}`}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-text mb-1">
                      Critical Protocol
                    </h3>
                    <p className="text-xs text-muted">
                      {totalNNs === 0
                        ? "No non-negotiables set"
                        : totalNNs - completedNNs > 0
                          ? `${totalNNs - completedNNs} at risk (-60 XP each)`
                          : "All clear — no penalties today"}
                    </p>
                  </motion.div>

                  {/* Growth Habits (Daily) */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.35 }}
                    className="glass glass-hover p-4 md:p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-xl bg-card-border/30">
                        <CheckCircle
                          size={18}
                          strokeWidth={1.5}
                          className="text-muted"
                        />
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          completedDaily === totalDaily && totalDaily > 0
                            ? "text-cyan"
                            : totalDaily > 0
                              ? "text-violet"
                              : "text-dim"
                        }`}
                      >
                        {totalDaily === 0
                          ? "No Habits"
                          : completedDaily === totalDaily
                            ? "All Done"
                            : `${completedDaily}/${totalDaily}`}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-text mb-1">
                      Growth Habits
                    </h3>
                    <p className="text-xs text-muted">
                      {totalDaily === 0
                        ? "No daily habits tracked yet"
                        : `${totalDaily - completedDaily} remaining`}
                    </p>
                  </motion.div>
                  {/* Wasted Potential */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.26, duration: 0.35 }}
                    className="glass glass-hover p-4 md:p-5 border border-pink/10"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-xl bg-pink/10">
                        <Skull
                          size={18}
                          strokeWidth={1.5}
                          className="text-pink"
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-pink">
                        {totalWasted > 0 ? "Losses" : "Clean"}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-text mb-1">
                      Wasted Potential
                    </h3>
                    <p className="text-xl font-bold text-pink tabular-nums font-mono">
                      {totalWasted > 0 ? `-${totalWasted.toLocaleString()} XP` : "0 XP"}
                    </p>
                    <p className="text-[9px] text-dim mt-2 font-mono tracking-wider">
                      STATUS: AUTHORITATIVE_LOSS_SYNCED
                    </p>
                  </motion.div>
                </div>
              </div>

              {/* Quick Stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="glass p-4 md:p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Quick Stats
                  </h3>
                  <span className="text-[11px] text-dim">Today</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-pink tabular-nums">
                      {completedNNs}/{totalNNs}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">NNs Hit</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-violet tabular-nums">
                      {completedDaily}/{totalDaily}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      Habits Done
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-cyan tabular-nums">
                      +{xpToday}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">XP Gained</p>
                  </div>
                </div>
              </motion.div>

            </>
          )}

          {/* ═══ OBJECTIVES TAB ═══ */}
          {activeTab === "objectives" && <ObjectivesView />}

          {/* ═══ HABITS TAB ═══ */}
          {activeTab === "habits" && <HabitsView />}

          {/* ═══ LOGS TAB ═══ */}
          {activeTab === "logs" && <LogsView />}

          {/* ═══ GHOST TAB — EMPTY STATE ═══ */}
          {activeTab === "ghost" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="glass p-8 md:p-12 flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-card-border/30 flex items-center justify-center mb-5">
                <Ghost size={28} strokeWidth={1.5} className="text-pink" />
              </div>
              <h3 className="text-base font-semibold text-text mb-2">
                The Arena
              </h3>
              <p className="text-sm text-muted max-w-xs mb-4">
                {tab.subtitle}
              </p>
              <div className="px-5 py-2.5 rounded-xl border border-card-border text-xs text-dim">
                Coming soon
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
