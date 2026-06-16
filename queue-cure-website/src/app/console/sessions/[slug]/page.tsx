"use client";

import { useParams } from "next/navigation";
import { Activity, Clock, Users } from "lucide-react";

export default function ActiveSessionPage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="p-4 sm:p-6 w-full">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Active Queue</h1>
        </div>
        <p className="text-slate-500 text-sm sm:text-base font-mono bg-slate-100 px-3 py-1 rounded-md inline-block">
          Session ID: {slug}
        </p>
      </div>

      {/* Placeholder Grid for the Receptionist Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Currently Serving & Call Next */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Users className="w-48 h-48" />
            </div>
            <p className="text-emerald-600 font-semibold tracking-wide uppercase text-sm mb-2">Currently Serving</p>
            <h2 className="text-6xl sm:text-8xl font-black text-slate-900 mb-6 tracking-tighter">
              T-001
            </h2>
            <div className="flex items-center space-x-4">
              <button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-500/30 text-lg">
                Call Next Token
              </button>
              <button className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-2xl transition-colors text-lg">
                Skip
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Waiting Queue</h3>
            <div className="space-y-3">
              {/* Placeholder waiting tokens */}
              {[2, 3, 4].map((num) => (
                <div key={num} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-bold text-slate-700 shadow-sm border border-slate-100">
                      T-00{num}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Patient Name</p>
                      <p className="text-sm text-slate-500">Waiting for 12 mins</p>
                    </div>
                  </div>
                  <span className="text-emerald-600 font-medium bg-emerald-50 px-3 py-1 rounded-full text-sm">
                    Est. 5 mins
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Add Patient & Stats */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl shadow-xl p-6 text-white relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Activity className="w-32 h-32" />
            </div>
            <h3 className="text-lg font-bold mb-4">Add Walk-in Patient</h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Patient Name" 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input 
                type="tel" 
                placeholder="Phone Number (Optional)" 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/20">
                Generate Token
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Avg. Consultation</p>
                <p className="text-xl font-bold text-slate-900">10m 00s</p>
              </div>
            </div>
            <button className="w-full py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium">
              Adjust Time
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
