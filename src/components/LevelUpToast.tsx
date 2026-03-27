"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpCircle } from "lucide-react";

interface LevelUpToastProps {
  show: boolean;
  level: number;
  rankName: string;
  isRankUp: boolean;
}

export default function LevelUpToast({
  show,
  level,
  rankName,
  isRankUp,
}: LevelUpToastProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.9 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[80]"
        >
          <div
            className="relative overflow-hidden rounded-2xl px-6 py-4 flex items-center gap-4"
            style={{
              backgroundColor: "#0a0a0a",
              border: isRankUp
                ? "1px solid rgba(6,182,212,0.6)"
                : "1px solid rgba(139,92,246,0.5)",
              boxShadow: isRankUp
                ? "0 0 32px rgba(6,182,212,0.25), 0 0 64px rgba(6,182,212,0.1)"
                : "0 0 32px rgba(139,92,246,0.25), 0 0 64px rgba(139,92,246,0.1)",
            }}
          >
            {/* Animated background pulse */}
            <motion.div
              className="absolute inset-0 opacity-0"
              animate={{ opacity: [0, 0.08, 0] }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{
                background: isRankUp
                  ? "radial-gradient(ellipse at center, #06b6d4, transparent)"
                  : "radial-gradient(ellipse at center, #8b5cf6, transparent)",
              }}
            />

            {/* Icon */}
            <motion.div
              initial={{ rotate: -20, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 18 }}
            >
              <ArrowUpCircle
                size={28}
                strokeWidth={1.5}
                style={{ color: isRankUp ? "#06b6d4" : "#8b5cf6" }}
              />
            </motion.div>

            {/* Text */}
            <div>
              <motion.p
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="text-[9px] font-semibold tracking-widest uppercase"
                style={{ color: isRankUp ? "#06b6d4" : "#8b5cf6" }}
              >
                {isRankUp ? "RANK_UP // SYSTEM_UPGRADE" : "LEVEL_UP // THRESHOLD_REACHED"}
              </motion.p>
              <motion.p
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.22 }}
                className="text-lg font-bold tracking-tighter text-white mt-0.5"
              >
                {isRankUp ? rankName : `Level ${level}`}
              </motion.p>
              {isRankUp && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="text-[10px] text-dim tracking-widest font-mono mt-0.5"
                >
                  LVL {level} · {rankName}
                </motion.p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
