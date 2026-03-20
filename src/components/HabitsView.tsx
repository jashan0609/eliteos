"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Flame, ShieldAlert, Sparkles } from "lucide-react";
import { useElite } from "@/context/EliteContext";

export default function HabitsView() {
  const {
    dailyHabits,
    nonNegotiables,
    addDailyHabit,
    addNonNegotiable,
    toggleDailyHabit,
    toggleNonNegotiable,
  } = useElite();

  const [nnTitle, setNnTitle] = useState("");
  const [dailyTitle, setDailyTitle] = useState("");
  const nnInputRef = useRef<HTMLInputElement>(null);
  const dailyInputRef = useRef<HTMLInputElement>(null);

  const handleAddNN = () => {
    const trimmed = nnTitle.trim();
    if (!trimmed) return;
    addNonNegotiable(trimmed);
    setNnTitle("");
    nnInputRef.current?.focus();
  };

  const handleAddDaily = () => {
    const trimmed = dailyTitle.trim();
    if (!trimmed) return;
    addDailyHabit(trimmed);
    setDailyTitle("");
    dailyInputRef.current?.focus();
  };

  return (
    <div className="space-y-8">
      {/* ═══ SECTION 1: THE RECKONING — Non-Negotiables ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert size={14} strokeWidth={2} className="text-pink" />
          <p className="text-[10px] text-pink font-semibold uppercase tracking-wider">
            The Reckoning
          </p>
          <span className="text-[10px] text-dim ml-auto">
            +30 XP each · -60 XP penalty if missed
          </span>
        </div>

        {/* NN Input */}
        <div className="glass p-3 mb-3 border border-pink/15"
          style={{ boxShadow: "0 0 20px rgba(244, 63, 94, 0.05)" }}
        >
          <div className="flex items-center gap-3">
            <input
              ref={nnInputRef}
              type="text"
              value={nnTitle}
              onChange={(e) => setNnTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddNN();
              }}
              placeholder="Add non-negotiable..."
              className="flex-1 bg-transparent border border-pink/20 rounded-xl px-4 py-3 text-base text-text placeholder:text-dim outline-none focus:border-pink/50 transition-colors"
              enterKeyHint="done"
            />
            <button
              onClick={handleAddNN}
              disabled={!nnTitle.trim()}
              className="p-3 rounded-xl bg-pink/15 text-pink cursor-pointer transition-all duration-200 hover:bg-pink/25 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <Plus size={20} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* NN List */}
        {nonNegotiables.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass p-6 text-center border border-pink/10"
          >
            <ShieldAlert
              size={24}
              strokeWidth={1.5}
              className="text-pink/40 mx-auto mb-2"
            />
            <p className="text-xs text-muted">
              No non-negotiables yet. These are the habits you can&apos;t afford
              to skip.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {nonNegotiables.map((habit, i) => (
                <motion.div
                  key={habit.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  onClick={() => toggleNonNegotiable(habit.id)}
                  className={`glass p-4 cursor-pointer group transition-all duration-200 border ${
                    habit.completedToday
                      ? "border-cyan/20 opacity-60"
                      : "border-pink/25"
                  }`}
                  style={
                    !habit.completedToday
                      ? {
                          boxShadow:
                            "0 0 15px rgba(244, 63, 94, 0.08), inset 0 0 30px rgba(244, 63, 94, 0.03)",
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                        habit.completedToday
                          ? "bg-cyan/20 border-cyan"
                          : "border-pink/40 group-hover:border-pink"
                      }`}
                    >
                      {habit.completedToday && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 25,
                          }}
                        >
                          <Check
                            size={14}
                            strokeWidth={3}
                            className="text-cyan"
                          />
                        </motion.div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium transition-colors duration-200 ${
                          habit.completedToday
                            ? "text-muted line-through"
                            : "text-text"
                        }`}
                      >
                        {habit.title}
                      </p>
                    </div>

                    {habit.streak > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-pink/80 shrink-0">
                        <Flame size={12} strokeWidth={2} />
                        <span className="font-bold tabular-nums">
                          {habit.streak}
                        </span>
                      </div>
                    )}

                    <span className="text-[10px] text-pink/50 font-semibold shrink-0">
                      +30 XP
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ═══ SECTION 2: DAILY MAINTENANCE — Growth Habits ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={14} strokeWidth={2} className="text-violet" />
          <p className="text-[10px] text-violet font-semibold uppercase tracking-wider">
            Daily Maintenance
          </p>
          <span className="text-[10px] text-dim ml-auto">+15 XP each</span>
        </div>

        {/* Daily Input */}
        <div className="glass p-3 mb-3">
          <div className="flex items-center gap-3">
            <input
              ref={dailyInputRef}
              type="text"
              value={dailyTitle}
              onChange={(e) => setDailyTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddDaily();
              }}
              placeholder="Add daily habit..."
              className="flex-1 bg-transparent border border-card-border rounded-xl px-4 py-3 text-base text-text placeholder:text-dim outline-none focus:border-violet/50 transition-colors"
              enterKeyHint="done"
            />
            <button
              onClick={handleAddDaily}
              disabled={!dailyTitle.trim()}
              className="p-3 rounded-xl bg-violet/15 text-violet cursor-pointer transition-all duration-200 hover:bg-violet/25 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <Plus size={20} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Daily List */}
        {dailyHabits.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass p-6 text-center"
          >
            <Sparkles
              size={24}
              strokeWidth={1.5}
              className="text-violet/40 mx-auto mb-2"
            />
            <p className="text-xs text-muted">
              No daily habits yet. Add the small wins that compound over time.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {dailyHabits.map((habit, i) => (
                <motion.div
                  key={habit.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  onClick={() => toggleDailyHabit(habit.id)}
                  className={`glass p-4 cursor-pointer group transition-all duration-200 border ${
                    habit.completedToday
                      ? "border-cyan/20 opacity-60"
                      : "border-card-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                        habit.completedToday
                          ? "bg-cyan/20 border-cyan"
                          : "border-dim group-hover:border-violet"
                      }`}
                    >
                      {habit.completedToday && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 25,
                          }}
                        >
                          <Check
                            size={14}
                            strokeWidth={3}
                            className="text-cyan"
                          />
                        </motion.div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium transition-colors duration-200 ${
                          habit.completedToday
                            ? "text-muted line-through"
                            : "text-text"
                        }`}
                      >
                        {habit.title}
                      </p>
                    </div>

                    {habit.streak > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-violet/80 shrink-0">
                        <Flame size={12} strokeWidth={2} />
                        <span className="font-bold tabular-nums">
                          {habit.streak}
                        </span>
                      </div>
                    )}

                    <span className="text-[10px] text-dim font-semibold shrink-0">
                      +15 XP
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
