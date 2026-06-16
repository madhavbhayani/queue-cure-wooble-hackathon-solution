"use client";

import { motion } from "framer-motion";
import { Clock, TrendingDown, Users, Activity, Smartphone, Zap } from "lucide-react";

export default function FeaturesShowcase() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div className="w-full max-w-2xl relative">
      {/* Decorative background elements - Emerald & Teal theme */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col space-y-8"
      >
        <motion.div variants={itemVariants} className="space-y-4">
          <h2 className="text-5xl font-bold text-white tracking-tight leading-tight">
            Stop the waiting room <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">chaos</span>.
          </h2>
          <p className="text-slate-400 text-xl max-w-lg">
            Give your patients live queue tracking on their phones, and manage flow beautifully from the reception.
          </p>
        </motion.div>

        {/* Abstract UI Representation - Real-time Stats */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 mt-8">
          
          {/* Card 1: Clinic Efficiency & Average Consult Time */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
                <Activity className="w-6 h-6" />
              </div>
              <div className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-semibold">
                <TrendingDown className="w-3 h-3" />
                <span>12% faster</span>
              </div>
            </div>
            
            <p className="text-slate-400 text-sm font-medium mb-1">Avg. Consultation</p>
            <div className="flex items-baseline space-x-2">
              <div className="text-4xl font-bold text-white tracking-tight">08<span className="text-2xl text-slate-400">m</span> 45<span className="text-2xl text-slate-400">s</span></div>
            </div>
            
            <div className="mt-6 pt-5 border-t border-slate-700/50">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">Dynamic updates</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
            </div>
          </div>

          {/* Card 2 & 3 Stack */}
          <div className="flex flex-col gap-4">
            {/* Card 2: Patient Flow */}
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl shadow-2xl flex-1 flex flex-col justify-center relative overflow-hidden">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-teal-500/20 rounded-xl text-teal-400">
                  <Users className="w-6 h-6" />
                </div>
                <div className="w-full">
                  <div className="flex justify-between items-end mb-2">
                    <h3 className="text-slate-400 font-medium text-sm">Flow Today</h3>
                    <span className="text-white font-bold">124 <span className="text-slate-500 text-xs font-normal">handled</span></span>
                  </div>
                  {/* Mini Progress Bar */}
                  <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-400 to-teal-400 h-1.5 rounded-full" style={{ width: '65%' }}></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Card 3: Live Sync Indicator */}
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl shadow-2xl flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium text-base mb-1 flex items-center">
                    <Zap className="w-4 h-4 text-emerald-400 mr-1.5" /> Live Sync
                  </h3>
                  <p className="text-slate-400 text-sm">45+ active patient devices</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                  <Smartphone className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
          
        </motion.div>

        {/* Floating Tagline */}
        <motion.div variants={itemVariants} className="mt-8 flex items-center space-x-3 text-sm font-medium text-slate-300 bg-slate-800/40 w-fit px-4 py-2 rounded-full border border-slate-700/50 backdrop-blur-sm">
          <Clock className="w-4 h-4 text-teal-400" />
          <span>Real-time algorithm adjusts wait times automatically</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
