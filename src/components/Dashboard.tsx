"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Target,
  Ghost,
  BookOpen,
  TrendingUp,
  ArrowRight,
  Sun,
  Moon,
} from "lucide-react";
import type { TabId } from "@/app/page";
import { useElite } from "@/context/EliteContext";
import ObjectivesView from "./ObjectivesView";
import ProtocolModal, { type CheckinType } from "./ProtocolModal";

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
  logs: {
    title: "Journal",
    subtitle: "Reflections, notes, and session logs",
    icon: BookOpen,
    accent: "text-muted",
  },
};

interface DashboardProps {
  activeTab: TabId;
}

export default function Dashboard({ activeTab }: DashboardProps) {
  const { completeProtocol, objectives, logs, lastCheckIn, xp, initializedAt } = useElite();
  const tab = TAB_CONTENT[activeTab];
  const TabIcon = tab.icon;

  const [activeCheckin, setActiveCheckin] = useState<CheckinType | null>(null);

  // Derive protocol card statuses from lastCheckIn
  const today = new Date().toISOString().slice(0, 10);
  const checkedInToday = lastCheckIn ? lastCheckIn.slice(0, 10) === today : false;

  const protocolCards = [
    {
      id: "morning" as CheckinType,
      title: "Morning Protocol",
      description: "Set your mission, check energy, lock in",
      icon: Sun,
      status: checkedInToday ? "Done" : "Ready",
      statusColor: checkedInToday ? "text-cyan" : "text-violet",
    },
    {
      id: "evening" as CheckinType,
      title: "Evening Debrief",
      description: "Log your session and reflect on the day",
      icon: Moon,
      status: "Pending",
      statusColor: "text-dim",
    },
  ];

  // Squandered potential calculation
  const MAX_DAILY_XP = 150;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysActive = Math.max(1, Math.ceil((Date.now() - new Date(initializedAt).getTime()) / msPerDay));
  const potentialXP = daysActive * MAX_DAILY_XP;
  const potentialWasted = Math.max(0, potentialXP - xp);
  const xpRatio = potentialXP > 0 ? (xp / potentialXP) * 100 : 0;

  // Derive stats from real data
  const completedObjectives = objectives.filter((o) => o.status === "Completed").length;
  const totalObjectives = objectives.length;

  const statCards = [
    {
      title: "Sprint Progress",
      description: `${completedObjectives} of ${totalObjectives} objectives completed`,
      icon: TrendingUp,
      status: completedObjectives === totalObjectives ? "Complete" : "In Progress",
      statusColor: completedObjectives === totalObjectives ? "text-cyan" : "text-violet",
    },
    {
      title: "Protocol Logs",
      description: `${logs.length} check-in${logs.length !== 1 ? "s" : ""} recorded`,
      icon: BookOpen,
      status: logs.length > 0 ? "Active" : "Empty",
      statusColor: logs.length > 0 ? "text-cyan" : "text-dim",
    },
  ];

  const handleProtocolComplete = useCallback(
    (answers: Record<string, string | number | boolean>) => {
      if (activeCheckin) {
        completeProtocol(activeCheckin, answers);
      }
      setActiveCheckin(null);
    },
    [activeCheckin, completeProtocol]
  );

  return (
    <>
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
                {/* Protocol Cards */}
                <div className="mb-4">
                  <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-3">
                    Daily Check-ins
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {protocolCards.map((card, index) => {
                      const Icon = card.icon;
                      return (
                        <motion.div
                          key={card.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08, duration: 0.35 }}
                          onClick={() => setActiveCheckin(card.id)}
                          className="glass glass-hover p-4 md:p-5 cursor-pointer group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-xl bg-violet/10">
                              <Icon
                                size={18}
                                strokeWidth={1.5}
                                className="text-violet"
                              />
                            </div>
                            <span
                              className={`text-[11px] font-semibold ${card.statusColor}`}
                            >
                              {card.status}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-text mb-1">
                            {card.title}
                          </h3>
                          <p className="text-xs text-muted">
                            {card.description}
                          </p>
                          <div className="mt-4 flex items-center gap-1 text-violet opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <span className="text-xs font-medium">
                              Start Check-in
                            </span>
                            <ArrowRight size={12} strokeWidth={2} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Activity Cards */}
                <div className="mb-6">
                  <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-3">
                    Activity
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {statCards.map((card, index) => {
                      const Icon = card.icon;
                      return (
                        <motion.div
                          key={card.title}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: 0.16 + index * 0.08,
                            duration: 0.35,
                          }}
                          className="glass glass-hover p-4 md:p-5 cursor-pointer group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-xl bg-card-border/30">
                              <Icon
                                size={18}
                                strokeWidth={1.5}
                                className="text-muted"
                              />
                            </div>
                            <span
                              className={`text-[11px] font-semibold ${card.statusColor}`}
                            >
                              {card.status}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-text mb-1">
                            {card.title}
                          </h3>
                          <p className="text-xs text-muted">
                            {card.description}
                          </p>
                        </motion.div>
                      );
                    })}
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
                    <span className="text-[11px] text-dim">All Time</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-violet">
                        {logs.length}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Check-ins
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-cyan">
                        {totalObjectives > 0
                          ? Math.round(
                              (completedObjectives / totalObjectives) * 100
                            )
                          : 0}
                        %
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Objectives
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-pink">
                        {objectives.filter((o) => o.status === "Active").length}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">Active</p>
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
                      <span className="text-base font-semibold text-pink/60 ml-1">XP</span>
                    </p>
                    <p className="text-[11px] text-muted mb-5">
                      lost to inaction
                    </p>

                    {/* Progress bar */}
                    <div className="w-full h-2.5 rounded-full overflow-hidden relative"
                      style={{ backgroundColor: "rgba(244, 63, 94, 0.12)", boxShadow: "inset 0 0 12px rgba(244, 63, 94, 0.15)" }}
                    >
                      <motion.div
                        className="h-full rounded-full relative z-10"
                        initial={{ width: 0 }}
                        animate={{ width: `${xpRatio}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
                        style={{
                          backgroundColor: "#8B5CF6",
                          boxShadow: "0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.25)",
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

            {/* ═══ LOGS TAB ═══ */}
            {activeTab === "logs" && (
              <div className="space-y-3">
                {logs.length === 0 ? (
                  <div className="glass p-8 md:p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-card-border/30 flex items-center justify-center mb-5 mx-auto">
                      <BookOpen size={28} strokeWidth={1.5} className="text-muted" />
                    </div>
                    <h3 className="text-base font-semibold text-text mb-2">
                      No logs yet
                    </h3>
                    <p className="text-sm text-muted max-w-xs mx-auto">
                      Complete a protocol check-in to see your entries here
                    </p>
                  </div>
                ) : (
                  logs.map((log, i) => {
                    const date = new Date(log.timestamp);
                    return (
                      <motion.div
                        key={log.timestamp}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.3 }}
                        className="glass p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-semibold text-violet uppercase tracking-wider">
                            {log.type} Protocol
                          </span>
                          <span className="text-[10px] text-muted">
                            {date.toLocaleDateString()} ·{" "}
                            {date.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {log.answers.objective && (
                            <div>
                              <span className="text-[10px] text-muted uppercase tracking-wider">
                                Mission
                              </span>
                              <p className="text-sm text-text">
                                {String(log.answers.objective)}
                              </p>
                            </div>
                          )}
                          {log.answers.microwin && (
                            <div>
                              <span className="text-[10px] text-muted uppercase tracking-wider">
                                Micro-Win
                              </span>
                              <p className="text-sm text-text">
                                {String(log.answers.microwin)}
                              </p>
                            </div>
                          )}
                          <div className="flex gap-4 pt-1">
                            {log.answers.energy !== undefined && (
                              <span className="text-xs text-muted">
                                Energy:{" "}
                                <span className="text-violet font-bold">
                                  {String(log.answers.energy)}/10
                                </span>
                              </span>
                            )}
                            {log.answers.effort !== undefined && (
                              <span className="text-xs text-muted">
                                Effort:{" "}
                                <span className="text-cyan font-bold">
                                  {String(log.answers.effort)}/10
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}

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

      {/* Protocol Modal */}
      {activeCheckin && (
        <ProtocolModal
          type={activeCheckin}
          open={!!activeCheckin}
          onClose={() => setActiveCheckin(null)}
          onComplete={handleProtocolComplete}
        />
      )}
    </>
  );
}
