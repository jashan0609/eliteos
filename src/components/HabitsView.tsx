"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Flame, ShieldAlert, Sparkles, Pencil, Trash2, X } from "lucide-react";
import { useElite } from "@/context/EliteContext";

export default function HabitsView() {
  const {
    dailyHabits,
    nonNegotiables,
    addDailyHabit,
    addNonNegotiable,
    toggleDailyHabit,
    toggleNonNegotiable,
    editDailyHabit,
    deleteDailyHabit,
    editNonNegotiable,
    deleteNonNegotiable,
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
              onKeyDown={(e) => { if (e.key === "Enter") handleAddNN(); }}
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
            <ShieldAlert size={24} strokeWidth={1.5} className="text-pink/40 mx-auto mb-2" />
            <p className="text-xs text-muted">
              No non-negotiables yet. These are the habits you can&apos;t afford to skip.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {nonNegotiables.map((habit, i) => (
                <HabitRow
                  key={habit.id}
                  id={habit.id}
                  title={habit.title}
                  completedToday={habit.completedToday}
                  streak={habit.streak}
                  index={i}
                  accent="pink"
                  xpLabel="+30 XP"
                  onToggle={toggleNonNegotiable}
                  onEdit={editNonNegotiable}
                  onDelete={deleteNonNegotiable}
                />
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
              onKeyDown={(e) => { if (e.key === "Enter") handleAddDaily(); }}
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
            <Sparkles size={24} strokeWidth={1.5} className="text-violet/40 mx-auto mb-2" />
            <p className="text-xs text-muted">
              No daily habits yet. Add the small wins that compound over time.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {dailyHabits.map((habit, i) => (
                <HabitRow
                  key={habit.id}
                  id={habit.id}
                  title={habit.title}
                  completedToday={habit.completedToday}
                  streak={habit.streak}
                  index={i}
                  accent="violet"
                  xpLabel="+15 XP"
                  onToggle={toggleDailyHabit}
                  onEdit={editDailyHabit}
                  onDelete={deleteDailyHabit}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function HabitRow({
  id,
  title,
  completedToday,
  streak,
  index,
  accent,
  xpLabel,
  onToggle,
  onEdit,
  onDelete,
}: {
  id: string;
  title: string;
  completedToday: boolean;
  streak: number;
  index: number;
  accent: "pink" | "violet";
  xpLabel: string;
  onToggle: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(title);
  const editInputRef = useRef<HTMLInputElement>(null);

  const accentBorder = accent === "pink" ? "border-pink/25" : "border-card-border";
  const accentDone = "border-cyan/20 opacity-60";
  const checkActive = "bg-cyan/20 border-cyan";
  const checkIdle = accent === "pink" ? "border-pink/40 group-hover:border-pink" : "border-dim group-hover:border-violet";
  const streakColor = accent === "pink" ? "text-pink/80" : "text-violet/80";
  const xpColor = accent === "pink" ? "text-pink/50" : "text-dim";

  const saveEdit = () => {
    const trimmed = editVal.trim();
    if (trimmed && trimmed !== title) onEdit(id, trimmed);
    else setEditVal(title);
    setEditing(false);
  };

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditVal(title);
    setEditing(true);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={() => { if (!editing) onToggle(id); }}
      className={`glass p-4 cursor-pointer group transition-all duration-200 border ${
        completedToday ? accentDone : accentBorder
      }`}
      style={
        !completedToday && accent === "pink"
          ? { boxShadow: "0 0 15px rgba(244, 63, 94, 0.08), inset 0 0 30px rgba(244, 63, 94, 0.03)" }
          : undefined
      }
    >
      {editing ? (
        /* Inline edit mode */
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <input
            ref={editInputRef}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") { setEditVal(title); setEditing(false); }
            }}
            onBlur={saveEdit}
            className="flex-1 bg-transparent border border-card-border rounded-lg px-3 py-1.5 text-sm text-text outline-none focus:border-violet transition-colors"
            enterKeyHint="done"
          />
          <button
            onMouseDown={(e) => { e.preventDefault(); saveEdit(); }}
            className="p-1.5 rounded-lg bg-violet/15 text-violet cursor-pointer shrink-0"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); setEditVal(title); setEditing(false); }}
            className="p-1.5 rounded-lg bg-card-border/30 text-muted cursor-pointer shrink-0"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ) : (
        /* Normal display */
        <div className="flex items-center gap-3">
          <div
            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
              completedToday ? checkActive : checkIdle
            }`}
          >
            {completedToday && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Check size={14} strokeWidth={3} className="text-cyan" />
              </motion.div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium transition-colors duration-200 ${
              completedToday ? "text-muted line-through" : "text-text"
            }`}>
              {title}
            </p>
          </div>

          {streak > 0 && (
            <div className={`flex items-center gap-1 text-[11px] shrink-0 ${streakColor}`}>
              <Flame size={12} strokeWidth={2} />
              <span className="font-bold tabular-nums">{streak}</span>
            </div>
          )}

          <span className={`text-[10px] font-semibold shrink-0 ${xpColor}`}>{xpLabel}</span>

          {/* Edit / Delete actions */}
          <div className="flex items-center gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={startEdit}
              className="p-1.5 rounded-lg text-dim hover:text-muted hover:bg-card-border/30 cursor-pointer transition-colors"
            >
              <Pencil size={13} strokeWidth={1.5} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-dim hover:text-pink hover:bg-pink/10 cursor-pointer transition-colors"
            >
              <Trash2 size={13} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
