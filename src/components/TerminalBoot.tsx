"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BOOT_STEPS = [
  { text: "Initializing EliteOS", delay: 0 },
  { text: "Loading personal protocols", delay: 400 },
  { text: "Syncing objectives", delay: 800 },
  { text: "Mapping your arena", delay: 1200 },
  { text: "Calibrating focus engine", delay: 1600 },
  { text: "Ready", delay: 2000 },
];

interface TerminalBootProps {
  onBootComplete: () => void;
}

export default function TerminalBoot({ onBootComplete }: TerminalBootProps) {
  const [phase, setPhase] = useState<"idle" | "booting" | "done">("idle");
  const [currentStep, setCurrentStep] = useState(0);

  const startBoot = useCallback(() => {
    console.log("System Initialization Triggered");
    setPhase("booting");
  }, []);

  useEffect(() => {
    if (phase !== "booting") return;

    const timers: NodeJS.Timeout[] = [];

    BOOT_STEPS.forEach((step, index) => {
      const timer = setTimeout(() => {
        setCurrentStep(index + 1);
      }, step.delay);
      timers.push(timer);
    });

    const finalTimer = setTimeout(() => {
      setPhase("done");
      setTimeout(onBootComplete, 300);
    }, 2600);
    timers.push(finalTimer);

    return () => timers.forEach(clearTimeout);
  }, [phase, onBootComplete]);

  const progress = (currentStep / BOOT_STEPS.length) * 100;

  if (phase === "done") return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "manipulation",
      }}
    >
      <div style={{ width: "100%", maxWidth: "28rem", padding: "0 2rem" }}>
        {phase === "idle" && (
          <div style={{ textAlign: "center" }}>
            {/* Logo */}
            <div style={{ marginBottom: "3rem", pointerEvents: "none" }}>
              <h1
                style={{
                  fontSize: "2.25rem",
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ color: "#8B5CF6" }}>Elite</span>
                <span style={{ color: "#F0F0F0" }}>OS</span>
              </h1>
              <p
                style={{
                  color: "#888",
                  fontSize: "0.875rem",
                  letterSpacing: "0.05em",
                }}
              >
                Your Operating System
              </p>
            </div>

            {/* Launch Button — inline styles only, no Tailwind, no transforms */}
            <button
              type="button"
              onClick={startBoot}
              style={{
                display: "inline-block",
                padding: "1rem 2.5rem",
                backgroundColor: "#8B5CF6",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                borderRadius: "1rem",
                border: "none",
                outline: "none",
                cursor: "pointer",
                WebkitTapHighlightColor: "rgba(139, 92, 246, 0.3)",
                touchAction: "manipulation",
                userSelect: "none",
                WebkitUserSelect: "none",
                position: "relative",
                zIndex: 10000,
              }}
            >
              Launch System
            </button>

            <p
              style={{
                color: "#555",
                fontSize: "0.75rem",
                marginTop: "2rem",
                letterSpacing: "0.05em",
                pointerEvents: "none",
              }}
            >
              Tap to initialize
            </p>
          </div>
        )}

        {phase === "booting" && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight mb-1">
                  <span className="text-violet">Elite</span>
                  <span className="text-text">OS</span>
                </h1>
              </div>

              <AnimatePresence mode="wait">
                <motion.p
                  key={currentStep}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="text-muted text-sm mb-8 h-5"
                >
                  {currentStep > 0
                    ? BOOT_STEPS[currentStep - 1].text
                    : "Starting..."}
                </motion.p>
              </AnimatePresence>

              <div className="w-full h-1 bg-card rounded-full overflow-hidden">
                <motion.div
                  className="h-full shimmer rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>

              <p className="text-dim text-xs mt-4 tabular-nums">
                {Math.round(progress)}%
              </p>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
