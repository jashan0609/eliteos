"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Rocket } from "lucide-react";
import type { Objective } from "@/context/EliteContext";

interface AddObjectiveModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (obj: Omit<Objective, "id" | "progress" | "status">) => void;
  editData?: { id: string; type: "north-star" | "sprint"; title: string; description: string };
  onEdit?: (id: string, data: { title: string; description: string }) => void;
}

export default function AddObjectiveModal({
  open,
  onClose,
  onAdd,
  editData,
  onEdit,
}: AddObjectiveModalProps) {
  const isEditing = !!editData;
  const [type, setType] = useState<"north-star" | "sprint">(
    editData?.type ?? "sprint"
  );
  const [title, setTitle] = useState(editData?.title ?? "");
  const [description, setDescription] = useState(editData?.description ?? "");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (isEditing && editData && onEdit) {
      onEdit(editData.id, { title: title.trim(), description: description.trim() });
    } else {
      onAdd({ type, title: title.trim(), description: description.trim() });
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:top-1/2
                       md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md
                       z-50 glass p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-text">
                {isEditing ? "Edit Objective" : "New Objective"}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-card-border/30 cursor-pointer transition-colors"
              >
                <X size={18} strokeWidth={1.5} className="text-muted" />
              </button>
            </div>

            {/* Type Toggle — locked in edit mode */}
            <div className="mb-5">
              <label className="text-[11px] text-muted font-medium uppercase tracking-wider block mb-2">
                Type
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => !isEditing && setType("north-star")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold
                             transition-all duration-200 border ${
                               type === "north-star"
                                 ? "border-violet bg-violet/15 text-violet"
                                 : "border-card-border text-muted"
                             } ${isEditing ? "opacity-50 cursor-default" : "cursor-pointer hover:border-dim"}`}
                >
                  <Star size={14} strokeWidth={1.5} />
                  Long Term
                </button>
                <button
                  onClick={() => !isEditing && setType("sprint")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold
                             transition-all duration-200 border ${
                               type === "sprint"
                                 ? "border-cyan bg-cyan/15 text-cyan"
                                 : "border-card-border text-muted"
                             } ${isEditing ? "opacity-50 cursor-default" : "cursor-pointer hover:border-dim"}`}
                >
                  <Rocket size={14} strokeWidth={1.5} />
                  Short Term
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="text-[11px] text-muted font-medium uppercase tracking-wider block mb-2">
                Objective Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    descriptionRef.current?.focus();
                  }
                }}
                placeholder="e.g., Ship the MVP"
                enterKeyHint="next"
                className="w-full bg-card border border-card-border rounded-xl px-4 py-2.5
                           text-base text-text placeholder:text-dim outline-none
                           focus:border-violet transition-colors duration-200"
              />
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="text-[11px] text-muted font-medium uppercase tracking-wider block mb-2">
                Brief Description
              </label>
              <textarea
                ref={descriptionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does success look like?"
                rows={3}
                className="w-full bg-card border border-card-border rounded-xl px-4 py-2.5
                           text-base text-text placeholder:text-dim outline-none resize-none
                           focus:border-violet transition-colors duration-200"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className={`w-full py-3 rounded-xl text-sm font-semibold cursor-pointer
                         transition-all duration-200 ${
                           title.trim()
                             ? type === "north-star"
                               ? "bg-violet text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-[0.98]"
                               : "bg-cyan text-black hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-[0.98]"
                             : "bg-card-border text-dim cursor-not-allowed"
                         }`}
            >
              {isEditing ? "Save Changes" : "Commence"}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
