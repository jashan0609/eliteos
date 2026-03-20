"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Target,
  Ghost,
  BookOpen,
  TrendingUp,
  Calendar,
  ArrowRight,
} from "lucide-react";
import type { TabId } from "@/app/page";

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

const ACTIVITY_CARDS = [
  {
    title: "Morning Protocol",
    description: "Daily habits and task queue",
    icon: Calendar,
    status: "Ready",
    statusColor: "text-cyan",
  },
  {
    title: "Sprint Progress",
    description: "3 of 7 objectives completed",
    icon: TrendingUp,
    status: "In Progress",
    statusColor: "text-violet",
  },
  {
    title: "Ghost Tracker",
    description: "2 rivals tracked this week",
    icon: Ghost,
    status: "Active",
    statusColor: "text-pink",
  },
  {
    title: "Evening Debrief",
    description: "Log your session and reflect",
    icon: BookOpen,
    status: "Pending",
    statusColor: "text-dim",
  },
];

interface DashboardProps {
  activeTab: TabId;
}

export default function Dashboard({ activeTab }: DashboardProps) {
  const tab = TAB_CONTENT[activeTab];
  const TabIcon = tab.icon;

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

          {/* Dashboard view — Activity Cards */}
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
              {ACTIVITY_CARDS.map((card, index) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.35 }}
                    className="glass glass-hover p-4 md:p-5 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-xl bg-card-border/30">
                        <Icon size={18} strokeWidth={1.5} className="text-muted" />
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
                    <p className="text-xs text-muted">{card.description}</p>
                    <div className="mt-4 flex items-center gap-1 text-violet opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-xs font-medium">Open</span>
                      <ArrowRight size={12} strokeWidth={2} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Non-dashboard tabs — Empty state */}
          {activeTab !== "dashboard" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="glass p-8 md:p-12 flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-card-border/30 flex items-center justify-center mb-5">
                <TabIcon size={28} strokeWidth={1.5} className={tab.accent} />
              </div>
              <h3 className="text-base font-semibold text-text mb-2">
                {tab.title}
              </h3>
              <p className="text-sm text-muted max-w-xs mb-4">
                {tab.subtitle}
              </p>
              <div className="px-5 py-2.5 rounded-xl border border-card-border text-xs text-dim">
                Coming soon
              </div>
            </motion.div>
          )}

          {/* Quick Stats — dashboard only */}
          {activeTab === "dashboard" && (
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
                <span className="text-[11px] text-dim">This Week</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-bold text-violet">12</p>
                  <p className="text-[11px] text-muted mt-0.5">Tasks Done</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-cyan">85%</p>
                  <p className="text-[11px] text-muted mt-0.5">Hit Rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-pink">3</p>
                  <p className="text-[11px] text-muted mt-0.5">Rivals Beat</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
