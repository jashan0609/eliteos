"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Flame, LogOut } from "lucide-react";
import { useElite } from "@/context/EliteContext";
import { useAuth } from "@/context/AuthContext";

function getClockTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function getTimezoneLabel() {
  return (
    Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? ""
  );
}

export default function Header() {
  const { xp, streak, levelData } = useElite();
  const { signOut } = useAuth();
  const [time, setTime] = useState(getClockTime);
  const [tz] = useState(getTimezoneLabel);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getClockTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.header
      initial={{ y: -48 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="h-12 bg-bg border-b border-card-border flex items-center justify-between px-3 md:px-6 shrink-0 relative"
    >
      {/* Left: Rank + Streak */}
      <div className="flex items-center gap-2">
        {/* Rank badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="px-2 py-0.5 rounded-md bg-violet/10 border border-violet/20 flex items-center gap-1.5"
        >
          <span className="text-[9px] text-dim uppercase tracking-widest">RANK</span>
          <span className="text-[10px] font-bold text-violet tracking-wider">
            {levelData.currentLevel}
          </span>
          <span className="text-[10px] text-dim">/</span>
          <span className="text-[10px] font-semibold text-violet/80 tracking-wider hidden sm:inline">
            {levelData.rankName}
          </span>
          <span className="text-[10px] font-semibold text-violet/80 tracking-wider sm:hidden">
            {levelData.rankName.slice(0, 3)}
          </span>
        </motion.div>

        {/* Streak */}
        <div className="flex items-center gap-1">
          <Flame size={12} strokeWidth={1.5} className="text-orange-400" />
          <span className="text-[9px] text-dim uppercase tracking-widest mr-0.5">STR</span>
          <span className="text-[10px] font-bold text-orange-400">{streak}</span>
        </div>
      </div>

      {/* Right: Time (desktop only) + XP + Sign Out */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Time — hidden on mobile */}
        <div className="hidden md:flex items-center gap-1.5">
          <Clock size={12} strokeWidth={1.5} className="text-dim" />
          <span className="text-[10px] text-muted tabular-nums font-medium tracking-wider">
            {time} {tz}
          </span>
        </div>

        <div className="hidden md:block w-px h-4 bg-card-border" />

        {/* XP */}
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] text-dim uppercase tracking-widest">XP</span>
          <span className="text-[11px] font-bold text-violet font-mono tracking-tight">
            {xp.toLocaleString()}
          </span>
        </div>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="p-1 text-muted hover:text-red-400 transition-colors cursor-pointer"
          title="Sign out"
        >
          <LogOut size={13} strokeWidth={1.5} />
        </button>
      </div>

      {/* Progress Underline */}
      <motion.div
        className="absolute bottom-0 left-0 h-px"
        initial={{ width: 0 }}
        animate={{ width: `${levelData.levelProgress}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{
          background: "#06B6D4",
          boxShadow: "0 0 6px rgba(6, 182, 212, 0.6), 0 0 12px rgba(6, 182, 212, 0.3)",
        }}
      />
    </motion.header>
  );
}
