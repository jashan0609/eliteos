"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

export type CheckinType = "morning" | "midday" | "evening";

interface ProtocolModalProps {
  type: CheckinType;
  open: boolean;
  onClose: () => void;
  onComplete: (answers: Record<string, string | number | boolean>) => void;
}

const LABELS: Record<CheckinType, string> = {
  morning: "Morning Protocol",
  midday: "Midday Ping",
  evening: "Evening Debrief",
};

interface Question {
  id: string;
  label: string;
  sub: string;
  kind: "text" | "slider" | "toggle";
}

const QUESTIONS: Question[] = [
  {
    id: "objective",
    label: "Objective",
    sub: "What is the primary mission for this block?",
    kind: "text",
  },
  {
    id: "energy",
    label: "Energy",
    sub: "Current energy level?",
    kind: "slider",
  },
  {
    id: "friction",
    label: "Friction",
    sub: "What is the single biggest distraction right now?",
    kind: "text",
  },
  {
    id: "compliance",
    label: "Compliance",
    sub: "Are you strictly following the protocol?",
    kind: "toggle",
  },
  {
    id: "microwin",
    label: "Micro-Win",
    sub: "What is one win achieved since the last ping?",
    kind: "text",
  },
  {
    id: "effort",
    label: "Effort",
    sub: "Rated effort for the last 4 hours?",
    kind: "slider",
  },
];

export default function ProtocolModal({
  type,
  open,
  onClose,
  onComplete,
}: ProtocolModalProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({
    energy: 5,
    effort: 5,
    compliance: true,
  });

  const question = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const progress = ((step + 1) / QUESTIONS.length) * 100;

  const updateAnswer = (value: string | number | boolean) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const next = () => {
    if (isLast) {
      onComplete(answers);
      setStep(0);
      setAnswers({ energy: 5, effort: 5, compliance: true });
    } else {
      setStep((s) => s + 1);
    }
  };

  const prev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleClose = () => {
    setStep(0);
    setAnswers({ energy: 5, effort: 5, compliance: true });
    onClose();
  };

  const canProceed =
    question.kind === "toggle" || question.kind === "slider"
      ? true
      : typeof answers[question.id] === "string" &&
        (answers[question.id] as string).trim().length > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50"
            onClick={handleClose}
          />

          {/* Modal — full screen on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2
                       md:-translate-x-1/2 md:-translate-y-1/2
                       md:w-full md:max-w-lg md:max-h-[90vh] md:rounded-2xl
                       z-50 bg-bg md:glass flex flex-col"
            style={{ backgroundColor: "#000" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-card-border shrink-0">
              <div>
                <h2 className="text-sm font-bold text-text">{LABELS[type]}</h2>
                <p className="text-[11px] text-muted mt-0.5">
                  Step {step + 1} of {QUESTIONS.length}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-card-border/30 cursor-pointer transition-colors"
              >
                <X size={20} strokeWidth={1.5} className="text-muted" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-card-border/30 shrink-0">
              <motion.div
                className="h-full bg-violet"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                style={{ boxShadow: "0 0 8px rgba(139,92,246,0.4)" }}
              />
            </div>

            {/* Question content */}
            <div className="flex-1 flex flex-col justify-center px-6 py-8 overflow-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Question label */}
                  <div className="mb-2">
                    <span className="text-[10px] font-semibold text-violet uppercase tracking-wider">
                      {question.label}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-text mb-8">
                    {question.sub}
                  </h3>

                  {/* Input based on kind */}
                  {question.kind === "text" && (
                    <textarea
                      value={(answers[question.id] as string) || ""}
                      onChange={(e) => updateAnswer(e.target.value)}
                      placeholder="Type your answer..."
                      rows={3}
                      autoFocus
                      className="w-full bg-card border border-card-border rounded-xl px-4 py-3
                                 text-base text-text placeholder:text-dim outline-none resize-none
                                 focus:border-violet transition-colors duration-200"
                    />
                  )}

                  {question.kind === "slider" && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-muted">Low</span>
                        <span className="text-3xl font-bold text-violet">
                          {answers[question.id] as number}
                        </span>
                        <span className="text-xs text-muted">High</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={answers[question.id] as number}
                        onChange={(e) => updateAnswer(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer
                                   bg-card-border accent-violet"
                        style={{ accentColor: "#8B5CF6" }}
                      />
                      <div className="flex justify-between mt-1">
                        {Array.from({ length: 10 }, (_, i) => (
                          <span key={i} className="text-[9px] text-dim w-4 text-center">
                            {i + 1}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {question.kind === "toggle" && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => updateAnswer(true)}
                        className={`flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer
                                   transition-all duration-200 border ${
                                     answers[question.id] === true
                                       ? "border-cyan bg-cyan/15 text-cyan"
                                       : "border-card-border text-muted hover:border-dim"
                                   }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => updateAnswer(false)}
                        className={`flex-1 py-4 rounded-xl text-sm font-bold cursor-pointer
                                   transition-all duration-200 border ${
                                     answers[question.id] === false
                                       ? "border-pink bg-pink/15 text-pink"
                                       : "border-card-border text-muted hover:border-dim"
                                   }`}
                      >
                        No
                      </button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer nav */}
            <div className="px-6 py-4 border-t border-card-border flex items-center justify-between shrink-0">
              <button
                onClick={prev}
                disabled={step === 0}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold
                           cursor-pointer transition-all duration-200 ${
                             step === 0
                               ? "text-dim cursor-not-allowed"
                               : "text-muted hover:text-text hover:bg-card-border/30"
                           }`}
              >
                <ArrowLeft size={14} strokeWidth={2} />
                Back
              </button>

              <button
                onClick={next}
                disabled={!canProceed}
                className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold
                           cursor-pointer transition-all duration-200 ${
                             !canProceed
                               ? "bg-card-border text-dim cursor-not-allowed"
                               : isLast
                               ? "bg-violet text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-95"
                               : "bg-violet text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-95"
                           }`}
              >
                {isLast ? (
                  <>
                    <Check size={14} strokeWidth={2} />
                    Complete
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={14} strokeWidth={2} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
