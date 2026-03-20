"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Target,
  Ghost,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";
import type { TabId } from "@/app/page";
import { useElite } from "@/context/EliteContext";
import ObjectivesView from "./ObjectivesView";
import HabitsView from "./HabitsView";

const TAB_CONTENT: Record<
  TabId,
  { title: string; subtitle: string; icon: typeof Zap; accent: string }
> = {
  dashboard: {
    title: "Your Protocol",
    subtitle: "Overview of your current sprint and activity",
    icon: Zap,
    accent: "text-violet",
  },
  objectives: {
    title: "Current Sprint",
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
};

interface DashboardProps {
  activeTab: TabId;
}

export default function Dashboard({ activeTab }: DashboardProps) {
  const { objectives, dailyHabits, nonNegotiables, xp, initializedAt } =
    useElite();
  const tab = TAB_CONTENT[activeTab];
  const TabIcon = tab.icon;

  // Squandered potential calculation
  const MAX_DAILY_XP = 150;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysActive = Math.max(
    1,
    Math.ceil((Date.now() - new Date(initializedAt).getTime()) / msPerDay)
  );
  const potentialXP = daysActive * MAX_DAILY_XP;
  const potentialWasted = Math.max(0, potentialXP - xp);
  const xpRatio = potentialXP > 0 ? (xp / potentialXP) * 100 : 0;

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
    <div className="flex-1 p-4 md:p-6 overflow-auto pb-24 md:pb-6">
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
              {/* Activity Cards */}
              <div className="mb-6">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-3">
                  Activity
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Sprint Progress */}
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
                      Sprint Progress
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

              {/* System Analytics — Squandered Potential */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.35 }}
                className="glass p-4 md:p-5 mt-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                    System Analytics
                  </h3>
                  <span className="text-[10px] text-dim">
                    {daysActive} day{daysActive !== 1 && "s"} active
                  </span>
                </div>

                <div className="glass p-4 md:p-5 border border-pink/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-pink uppercase tracking-wider">
                      SQUANDERED_POTENTIAL
                    </span>
                    <span className="text-[10px] text-muted">
                      {xp.toLocaleString()} / {potentialXP.toLocaleString()} XP
                    </span>
                  </div>

                  <p className="text-4xl font-bold text-pink mt-3 mb-1 tabular-nums">
                    {potentialWasted.toLocaleString()}
                    <span className="text-base font-semibold text-pink/60 ml-1">
                      XP
                    </span>
                  </p>
                  <p className="text-[11px] text-muted mb-5">
                    lost to inaction
                  </p>

                  {/* Progress bar */}
                  <div
                    className="w-full h-2.5 rounded-full overflow-hidden relative"
                    style={{
                      backgroundColor: "rgba(244, 63, 94, 0.12)",
                      boxShadow: "inset 0 0 12px rgba(244, 63, 94, 0.15)",
                    }}
                  >
                    <motion.div
                      className="h-full rounded-full relative z-10"
                      initial={{ width: 0 }}
                      animate={{ width: `${xpRatio}%` }}
                      transition={{
                        duration: 0.8,
                        ease: "easeOut",
                        delay: 0.6,
                      }}
                      style={{
                        backgroundColor: "#8B5CF6",
                        boxShadow:
                          "0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.25)",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-violet font-semibold">
                      {Math.round(xpRatio)}% captured
                    </span>
                    <span className="text-[10px] text-pink font-semibold">
                      {Math.round(100 - xpRatio)}% wasted
                    </span>
                  </div>
                </div>
              </motion.div>
            </>
          )}

          {/* ═══ OBJECTIVES TAB ═══ */}
          {activeTab === "objectives" && <ObjectivesView />}

          {/* ═══ HABITS TAB ═══ */}
          {activeTab === "habits" && <HabitsView />}

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
