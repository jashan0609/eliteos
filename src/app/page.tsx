"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TerminalBoot from "@/components/TerminalBoot";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";

export type TabId = "dashboard" | "objectives" | "ghost" | "logs";

export default function Home() {
  const [booted, setBooted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  const handleBootComplete = useCallback(() => {
    setBooted(true);
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden bg-bg">
      <TerminalBoot onBootComplete={handleBootComplete} />

      <AnimatePresence>
        {booted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="h-full flex flex-col md:flex-row"
          >
            {/* Desktop sidebar */}
            <div className="hidden md:flex">
              <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <Header />
              <Dashboard activeTab={activeTab} />
            </div>

            {/* Mobile bottom nav */}
            <div className="md:hidden">
              <Sidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                mobile
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
