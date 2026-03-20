"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Star, Rocket, ChevronUp } from "lucide-react";
import { useElite, type Objective } from "@/context/EliteContext";
import AddObjectiveModal from "./AddObjectiveModal";

export default function ObjectivesView() {
  const { objectives, addObjective, incrementObjectiveProgress } = useElite();
  const [modalOpen, setModalOpen] = useState(false);

  const northStars = objectives.filter((o) => o.type === "north-star");
  const sprints = objectives.filter((o) => o.type === "sprint");

  return (
    <>
      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">
            {objectives.length} Objective{objectives.length !== 1 && "s"} ·{" "}
            {objectives.filter((o) => o.status === "Active").length} Active
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
              North Stars
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
              Sprints
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
  const isNorthStar = objective.type === "north-star";
  const accent = isNorthStar ? "#8B5CF6" : "#06B6D4";
  const accentClass = isNorthStar ? "text-violet" : "text-cyan";
  const isComplete = objective.status === "Completed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className="glass glass-hover p-5 group"
      style={
        isNorthStar
          ? { boxShadow: `0 0 24px rgba(139, 92, 246, 0.08)` }
          : undefined
      }
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
            {isNorthStar ? "North Star" : "Sprint"}
          </span>
        </div>
        <span
          className={`text-[10px] font-semibold ${
            isComplete ? "text-cyan" : "text-muted"
          }`}
        >
          {objective.status}
        </span>
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
          onClick={() => onIncrement(objective.id)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium cursor-pointer
                     opacity-60 hover:opacity-100 transition-opacity duration-200"
          style={{ color: accent }}
        >
          <ChevronUp size={14} strokeWidth={2} />
          +10%
        </button>
      )}
    </motion.div>
  );
}
