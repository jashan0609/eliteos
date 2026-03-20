"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Zap, AlertTriangle } from "lucide-react";

interface XPToastProps {
  show: boolean;
  type: "gain" | "loss";
  amount: number;
  message: string;
}

export default function XPToast({ show, type, amount, message }: XPToastProps) {
  const isGain = type === "gain";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[70]"
        >
          <div
            className="glass flex items-center gap-3 px-5 py-3"
            style={{
              borderColor: isGain ? "#8B5CF6" : "#F43F5E",
              boxShadow: isGain
                ? "0 0 24px rgba(139,92,246,0.2)"
                : "0 0 24px rgba(244,63,94,0.2)",
            }}
          >
            {isGain ? (
              <Zap size={18} strokeWidth={1.5} className="text-violet shrink-0" />
            ) : (
              <AlertTriangle size={18} strokeWidth={1.5} className="text-pink shrink-0" />
            )}
            <div>
              <p className="text-xs font-bold text-text">{message}</p>
              <p
                className={`text-sm font-bold ${isGain ? "text-violet" : "text-pink"}`}
              >
                {isGain ? "+" : ""}
                {amount} XP
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
