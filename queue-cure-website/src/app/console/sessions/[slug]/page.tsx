"use client";

import { useParams, useRouter } from "next/navigation";
import { Activity, Clock, Users, Loader2, StopCircle, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { sessionService } from "@/services/session.service";
import { toast } from "sonner";

export default function ActiveSessionPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    fetchSessionDetails();
  }, [slug]);

  const fetchSessionDetails = async () => {
    try {
      const data = await sessionService.getSessionDetails(slug);
      setSession(data);
    } catch (error) {
      toast.error("Failed to load session details");
      router.push("/console/sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!confirm("Are you sure you want to end this session?")) return;
    
    setIsEnding(true);
    try {
      await sessionService.endSession(slug);
      toast.success("Session ended successfully");
      router.push("/console/sessions");
    } catch (error) {
      toast.error("Failed to end session");
      setIsEnding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const isActive = session.is_active;

  return (
    <div className="p-4 sm:p-6 w-full pb-32">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            {isActive ? (
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
            ) : (
              <div className="w-3 h-3 bg-slate-400 rounded-full" />
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {isActive ? "Active Queue Dashboard" : "Session History"}
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <p className="text-slate-500 text-sm sm:text-base font-mono bg-slate-100 px-3 py-1 rounded-md inline-block">
              ID: {slug}
            </p>
            {!isActive && (
              <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full flex items-center space-x-1 border border-slate-200">
                <CheckCircle className="w-4 h-4 text-slate-400" />
                <span>Closed</span>
              </span>
            )}
          </div>
        </div>

        {/* End Session Button */}
        {isActive && (
          <button 
            onClick={handleEndSession}
            disabled={isEnding}
            className="flex items-center justify-center space-x-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-5 py-2.5 rounded-xl font-medium transition-colors sm:w-auto w-full"
          >
            {isEnding ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
            <span>{isEnding ? "Ending..." : "End Session"}</span>
          </button>
        )}
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Currently Serving & Call Next (or History Stats if inactive) */}
        <div className="lg:col-span-2 space-y-6">
          {isActive ? (
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
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Final Session Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-slate-500 text-sm font-medium mb-1">Total Tokens Issued</p>
                  <p className="text-3xl font-bold text-slate-900">{session.total_tokens_issued}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-slate-500 text-sm font-medium mb-1">Tokens Completed</p>
                  <p className="text-3xl font-bold text-slate-900">{session.total_tokens_done}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {isActive ? "Waiting Queue" : "Completed Queue Log"}
            </h3>
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
                      <p className="text-sm text-slate-500">
                        {isActive ? "Waiting for 12 mins" : "Completed in 15 mins"}
                      </p>
                    </div>
                  </div>
                  {isActive && (
                    <span className="text-emerald-600 font-medium bg-emerald-50 px-3 py-1 rounded-full text-sm">
                      Est. 5 mins
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Add Patient & Stats */}
        <div className="space-y-6">
          {isActive && (
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
          )}

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Avg. Consultation</p>
                <p className="text-xl font-bold text-slate-900">
                  {Math.floor(session.avg_consult_secs / 60)}m {session.avg_consult_secs % 60}s
                </p>
              </div>
            </div>
            {isActive && (
              <button className="w-full py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium">
                Adjust Time
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
