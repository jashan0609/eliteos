"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Star, Rocket, ChevronUp, Trophy } from "lucide-react";
import { useElite, type Objective } from "@/context/EliteContext";
import AddObjectiveModal from "./AddObjectiveModal";

export default function ObjectivesView() {
  const { objectives, addObjective, incrementObjectiveProgress } = useElite();
  const [modalOpen, setModalOpen] = useState(false);

  const northStars = objectives.filter((o) => o.type === "north-star" && o.status !== "Completed");
  const sprints = objectives.filter((o) => o.type === "sprint" && o.status !== "Completed");

  return (
    <>
      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">
            {northStars.length + sprints.length} Active ·{" "}
            {objectives.filter((o) => o.status === "Completed").length} Completed
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet text-white text-xs font-semibold
                     cursor-pointer transition-all duration-200
                     hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] active:scale-95"
        >
          <Plus size={14} strokeWidth={2} />
          New Objective
        </button>
      </div>

      {/* North Stars */}
      {northStars.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} strokeWidth={1.5} className="text-violet" />
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Long Term
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {northStars.map((obj, i) => (
              <ObjectiveCard
                key={obj.id}
                objective={obj}
                index={i}
                onIncrement={incrementObjectiveProgress}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sprints */}
      {sprints.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Rocket size={14} strokeWidth={1.5} className="text-cyan" />
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Short Term
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sprints.map((obj, i) => (
              <ObjectiveCard
                key={obj.id}
                objective={obj}
                index={i}
                onIncrement={incrementObjectiveProgress}
              />
            ))}
          </div>
        </div>
      )}

      {objectives.length === 0 && (
        <div className="glass p-10 text-center">
          <p className="text-muted text-sm mb-3">No objectives yet</p>
          <button
            onClick={() => setModalOpen(true)}
            className="text-violet text-xs font-semibold cursor-pointer hover:underline"
          >
            Create your first objective
          </button>
        </div>
      )}

      <AddObjectiveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={addObjective}
      />
    </>
  );
}

function ObjectiveCard({
  objective,
  index,
  onIncrement,
}: {
  objective: Objective;
  index: number;
  onIncrement: (id: string) => void;
}) {
  const [justCompleted, setJustCompleted] = useState(false);
  const isNorthStar = objective.type === "north-star";
  const accent = isNorthStar ? "#8B5CF6" : "#06B6D4";
  const accentClass = isNorthStar ? "text-violet" : "text-cyan";
  const isComplete = objective.status === "Completed";

  const handleIncrement = () => {
    if (isComplete) return;
    // Check if this increment will complete the objective
    if (objective.progress + 10 >= 100) {
      setJustCompleted(true);
    }
    onIncrement(objective.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: justCompleted
          ? [
              `0 0 0px ${accent}00`,
              `0 0 40px ${accent}66`,
              `0 0 20px ${accent}33`,
              `0 0 0px ${accent}00`,
            ]
          : isNorthStar
            ? `0 0 24px rgba(139, 92, 246, 0.08)`
            : "none",
      }}
      transition={
        justCompleted
          ? { boxShadow: { duration: 1.2, times: [0, 0.3, 0.7, 1] } }
          : { delay: index * 0.08, duration: 0.35 }
      }
      onAnimationComplete={() => {
        if (justCompleted) setJustCompleted(false);
      }}
      className="glass glass-hover p-5 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isNorthStar ? (
            <Star size={16} strokeWidth={1.5} className="text-violet" />
          ) : (
            <Rocket size={16} strokeWidth={1.5} className="text-cyan" />
          )}
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider ${accentClass}`}
          >
            {isNorthStar ? "Long Term" : "Short Term"}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {isComplete ? (
            <motion.div
              key="achieved"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{
                backgroundColor: `${accent}1A`,
                boxShadow: `0 0 12px ${accent}33`,
              }}
            >
              <Trophy size={12} strokeWidth={2} style={{ color: accent }} />
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: accent }}
              >
                Achieved
              </span>
            </motion.div>
          ) : (
            <motion.span
              key="status"
              className="text-[10px] font-semibold text-muted"
            >
              {objective.status}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <h3 className="text-sm font-bold text-text mb-1.5">{objective.title}</h3>
      <p className="text-xs text-muted leading-relaxed mb-4">
        {objective.description}
      </p>

      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted font-medium">Progress</span>
          <span className={`text-xs font-bold ${accentClass}`}>
            {objective.progress}%
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-card-border/50 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${objective.progress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              backgroundColor: accent,
              boxShadow: `0 0 8px ${accent}66, 0 0 16px ${accent}33`,
            }}
          />
        </div>
      </div>

      {!isComplete && (
        <button
          onClick={handleIncrement}
          className="mt-3 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer
                     transition-all duration-200 active:scale-95"
          style={{
            color: accent,
            backgroundColor: `${accent}15`,
          }}
        >
          <ChevronUp size={14} strokeWidth={2} />
          +10%
        </button>
      )}

      {/* Completion XP hint */}
      {!isComplete && objective.progress >= 70 && (
        <p className="text-[10px] text-dim mt-2">
          {isNorthStar ? "+500 XP" : "+200 XP"} on completion
        </p>
      )}
    </motion.div>
  );
}
