"use client";

import { motion } from "framer-motion";
import { BookOpen, Check, X, Shield, Sparkles } from "lucide-react";
import { useElite } from "@/context/EliteContext";

export default function LogsView() {
  const { logs } = useElite();

  if (logs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass p-8 md:p-12 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-card-border/30 flex items-center justify-center mb-5 mx-auto">
          <BookOpen size={28} strokeWidth={1.5} className="text-muted" />
        </div>
        <h3 className="text-base font-semibold text-text mb-2">
          No system logs found
        </h3>
        <p className="text-sm text-muted max-w-xs mx-auto">
          Complete a day to generate telemetry. Logs archive automatically at
          each daily reset.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log, i) => {
        const nnHit = log.nnSummary.filter((n) => n.completed).length;
        const nnTotal = log.nnSummary.length;
        const habitsHit = log.habitSummary.filter((h) => h.completed).length;
        const habitsTotal = log.habitSummary.length;
        const allNNsCleared = nnHit === nnTotal && nnTotal > 0;
        const hasNNs = nnTotal > 0;

        const rating = !hasNNs
          ? "NO_PROTOCOL"
          : allNNsCleared
            ? "OPTIMAL_PERFORMANCE"
            : "CRITICAL_FAILURE";

        return (
          <motion.div
            key={log.date + i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="glass p-4 md:p-5"
            style={
              rating === "CRITICAL_FAILURE"
                ? { borderColor: "rgba(244, 63, 94, 0.15)" }
                : rating === "OPTIMAL_PERFORMANCE"
                  ? { borderColor: "rgba(6, 182, 212, 0.15)" }
                  : undefined
            }
          >
            {/* Header row: date + rating + XP */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span
                  className="text-sm font-bold text-text tracking-tight"
                  style={{ fontFamily: "monospace" }}
                >
                  {new Date(log.date + "T12:00:00").toLocaleDateString(
                    undefined,
                    {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    }
                  )}
                </span>

                {/* Performance Rating Tag */}
                {rating === "OPTIMAL_PERFORMANCE" && (
                  <span
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-cyan"
                    style={{
                      backgroundColor: "rgba(6, 182, 212, 0.1)",
                      boxShadow: "0 0 8px rgba(6, 182, 212, 0.2)",
                    }}
                  >
                    <Sparkles size={10} strokeWidth={2} />
                    Optimal
                  </span>
                )}
                {rating === "CRITICAL_FAILURE" && (
                  <span
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-pink"
                    style={{
                      backgroundColor: "rgba(244, 63, 94, 0.1)",
                      boxShadow: "0 0 8px rgba(244, 63, 94, 0.15)",
                    }}
                  >
                    <Shield size={10} strokeWidth={2} />
                    Failure
                  </span>
                )}
              </div>

              {/* XP Badge */}
              <span className="text-[11px] font-bold text-cyan tabular-nums px-2.5 py-1 rounded-lg bg-cyan/10">
                {log.totalXpAtTime.toLocaleString()} XP
              </span>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* NNs */}
              <div
                className="rounded-xl px-3 py-2.5"
                style={{
                  backgroundColor: allNNsCleared
                    ? "rgba(6, 182, 212, 0.06)"
                    : "rgba(244, 63, 94, 0.06)",
                }}
              >
                <p
                  className={`text-lg font-bold tabular-nums ${allNNsCleared ? "text-cyan" : "text-pink"}`}
                >
                  {nnHit}/{nnTotal}
                </p>
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wider ${allNNsCleared ? "text-cyan/60" : "text-pink/60"}`}
                >
                  {allNNsCleared ? "NNs Cleared" : "NNs Hit"}
                </p>
              </div>

              {/* Habits */}
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ backgroundColor: "rgba(139, 92, 246, 0.06)" }}
              >
                <p className="text-lg font-bold text-violet tabular-nums">
                  {habitsHit}/{habitsTotal}
                </p>
                <p className="text-[10px] font-semibold text-violet/60 uppercase tracking-wider">
                  Habits Done
                </p>
              </div>
            </div>

            {/* Penalty callout */}
            {log.penalty > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
                style={{ backgroundColor: "rgba(244, 63, 94, 0.08)" }}
              >
                <X size={14} strokeWidth={3} className="text-pink shrink-0" />
                <span className="text-xs font-semibold text-pink">
                  -{log.penalty} XP penalty applied
                </span>
              </div>
            )}

            {/* Detailed breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* NN detail */}
              {nnTotal > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
                    Non-Negotiables
                  </p>
                  <div className="space-y-1.5">
                    {log.nnSummary.map((nn) => (
                      <div key={nn.title} className="flex items-center gap-2">
                        {nn.completed ? (
                          <Check
                            size={12}
                            strokeWidth={3}
                            className="text-cyan shrink-0"
                          />
                        ) : (
                          <X
                            size={12}
                            strokeWidth={3}
                            className="text-pink shrink-0"
                          />
                        )}
                        <span
                          className={`text-xs ${nn.completed ? "text-muted" : "text-pink/70"}`}
                        >
                          {nn.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Habit detail */}
              {habitsTotal > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
                    Daily Habits
                  </p>
                  <div className="space-y-1.5">
                    {log.habitSummary.map((h) => (
                      <div key={h.title} className="flex items-center gap-2">
                        {h.completed ? (
                          <Check
                            size={12}
                            strokeWidth={3}
                            className="text-cyan shrink-0"
                          />
                        ) : (
                          <X
                            size={12}
                            strokeWidth={3}
                            className="text-dim shrink-0"
                          />
                        )}
                        <span
                          className={`text-xs ${h.completed ? "text-muted" : "text-dim"}`}
                        >
                          {h.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
