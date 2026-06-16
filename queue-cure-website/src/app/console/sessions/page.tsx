"use client";

import { Play, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sessionService } from "@/services/session.service";
import { toast } from "sonner";

export default function SessionsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { active, slug } = await sessionService.getActiveSession();
        if (active) {
          router.push(`/console/sessions/${slug}`);
        } else {
          setIsLoading(false); // Only stop loading if there's no active session
        }
      } catch (error) {
        console.error("Failed to check active session", error);
        setIsLoading(false);
      }
    };
    checkSession();
  }, [router]);

  const handleStartSession = async () => {
    setIsStarting(true);
    try {
      const response = await sessionService.startSession();
      toast.success("Session started successfully!");
      router.push(`/console/sessions/${response.slug}`);
    } catch (error) {
      toast.error("Failed to start session.");
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 w-full flex items-center justify-center h-[80vh]">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 w-full h-full flex flex-col relative pb-32">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Live Queue Sessions</h1>
          <p className="text-slate-500 text-sm sm:text-base mt-1">Manage patients and consultation times efficiently.</p>
        </div>
        <button 
          onClick={handleStartSession}
          disabled={isStarting}
          className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-400 rounded-xl transition-all font-medium shadow-lg shadow-emerald-500/30 text-sm sm:text-base"
        >
          {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span className="hidden sm:inline">{isStarting ? "Starting..." : "Start Session"}</span>
          <span className="inline sm:hidden">{isStarting ? "Wait..." : "Start"}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 p-4 sm:p-6 flex-1 flex flex-col items-center justify-center border-dashed min-h-[50vh]">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4">
          <Play className="w-8 h-8 ml-1" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">No Active Session</h2>
        <p className="text-slate-500 text-center max-w-md">
          Start a new queue session to begin managing tokens and patients for today.
        </p>
      </div>

    </div>
  );
}
