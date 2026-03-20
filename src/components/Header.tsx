"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Zap, Flame } from "lucide-react";
import { useElite } from "@/context/EliteContext";

export default function Header() {
  const { xp, streak } = useElite();
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, "0");
      const m = String(now.getUTCMinutes()).padStart(2, "0");
      const s = String(now.getUTCSeconds()).padStart(2, "0");
      setTime(`${h}:${m}:${s}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const glowIntensity = Math.min(0.2 + (xp / 10000) * 0.8, 1.0);

  return (
    <motion.header
      initial={{ y: -56 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="h-14 bg-bg border-b border-card-border flex items-center justify-between px-4 md:px-6 shrink-0"
    >
      {/* Left: Operator Status */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
        <span className="text-xs text-muted font-medium hidden sm:inline">
          OPERATOR_STATUS:
        </span>
        <span className="text-xs text-cyan font-semibold">ACTIVE</span>
      </div>

      {/* Center: Daily Streak */}
      <div className="flex items-center gap-2">
        <Flame
          size={16}
          strokeWidth={1.5}
          className="text-orange-400 streak-glow"
        />
        <span className="text-xs font-bold text-orange-400 streak-glow">
          {streak} DAY STREAK
        </span>
      </div>

      {/* Right: Time + XP */}
      <div className="flex items-center gap-3 md:gap-5">
        <div className="flex items-center gap-1.5">
          <Clock size={14} strokeWidth={1.5} className="text-dim" />
          <span className="text-xs text-muted tabular-nums font-medium">
            {time}
            <span className="text-dim ml-1 hidden sm:inline">UTC</span>
          </span>
        </div>

        <div className="w-px h-4 bg-card-border" />

        <div className="flex items-center gap-1.5">
          <Zap size={14} strokeWidth={1.5} className="text-violet" />
          <span className="text-xs text-muted font-medium hidden sm:inline">
            XP
          </span>
          <span
            className="text-sm font-bold text-violet xp-glow"
            style={
              { "--glow-intensity": glowIntensity } as React.CSSProperties
            }
          >
            {xp.toLocaleString()}
          </span>
        </div>
      </div>
    </motion.header>
  );
}
