"use client";

import { motion } from "framer-motion";
import { Home, Target, Ghost, CheckCircle } from "lucide-react";
import type { TabId } from "@/app/page";

const NAV_ITEMS: {
  id: TabId;
  label: string;
  mobileLabel: string;
  icon: typeof Home;
}[] = [
  { id: "dashboard", label: "Dashboard", mobileLabel: "Home", icon: Home },
  { id: "objectives", label: "Objectives", mobileLabel: "Goals", icon: Target },
  { id: "ghost", label: "The Ghost", mobileLabel: "Ghost", icon: Ghost },
  { id: "habits", label: "Habits", mobileLabel: "Habits", icon: CheckCircle },
];

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  mobile?: boolean;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  mobile,
}: SidebarProps) {
  if (mobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-card-border flex items-stretch h-16 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors duration-200"
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-violet/15 nav-active-glow"
                    : ""
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  className={`transition-colors duration-200 ${
                    isActive ? "text-violet" : "text-dim"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  isActive ? "text-violet" : "text-dim"
                }`}
              >
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <motion.aside
      initial={{ x: -240 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-55 min-h-screen bg-bg border-r border-card-border flex flex-col shrink-0"
    >
      {/* Logo */}
      <div className="p-6 pb-4">
        <h2 className="text-lg font-bold tracking-tight">
          <span className="text-violet">Elite</span>
          <span className="text-text">OS</span>
        </h2>
        <p className="text-dim text-[11px] mt-0.5">Your Operating System</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full text-left px-3 py-2.5 mb-1 flex items-center gap-3 rounded-xl cursor-pointer
                transition-all duration-200 group
                ${
                  isActive
                    ? "bg-violet/10 nav-active-glow"
                    : "hover:bg-card/50"
                }`}
            >
              <Icon
                size={18}
                strokeWidth={1.5}
                className={`transition-colors duration-200 ${
                  isActive
                    ? "text-violet"
                    : "text-dim group-hover:text-muted"
                }`}
              />
              <span
                className={`text-sm font-medium transition-colors duration-200 ${
                  isActive ? "text-violet" : "text-muted group-hover:text-text"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-card-border">
        <div className="text-[11px] text-dim">
          <div className="flex justify-between">
            <span>v2.0</span>
            <span className="text-cyan">Online</span>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
