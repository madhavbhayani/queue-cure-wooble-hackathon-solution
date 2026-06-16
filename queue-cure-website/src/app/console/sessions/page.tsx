"use client";

import { Play, Loader2, Calendar, Clock, Users, Search, Filter, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sessionService } from "@/services/session.service";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import Link from "next/link";
import clsx from "clsx";

export default function SessionsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  // Filter States
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const [minPatients, setMinPatients] = useState("");
  const debouncedMinPatients = useDebounce(minPatients, 500);

  const [maxPatients, setMaxPatients] = useState("");
  const debouncedMaxPatients = useDebounce(maxPatients, 500);

  const [minAvgTime, setMinAvgTime] = useState("");
  const debouncedMinAvgTime = useDebounce(minAvgTime, 500);

  const [maxAvgTime, setMaxAvgTime] = useState("");
  const debouncedMaxAvgTime = useDebounce(maxAvgTime, 500);

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [debouncedSearch, debouncedMinPatients, debouncedMaxPatients, debouncedMinAvgTime, debouncedMaxAvgTime]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (debouncedMinPatients) params.minPatients = debouncedMinPatients;
      if (debouncedMaxPatients) params.maxPatients = debouncedMaxPatients;
      if (debouncedMinAvgTime) params.minAvgTime = debouncedMinAvgTime;
      if (debouncedMaxAvgTime) params.maxAvgTime = debouncedMaxAvgTime;

      const data = await sessionService.getAllSessions(params);
      setSessions(data);
    } catch (error) {
      console.error("Failed to fetch sessions", error);
      toast.error("Failed to load sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSession = async () => {
    setIsStarting(true);
    try {
      const response = await sessionService.startSession();
      toast.success("Session started successfully!");
      await fetchSessions();
      router.push(`/console/sessions/${response.slug}`);
    } catch (error) {
      toast.error("Failed to start session.");
    } finally {
      setIsStarting(false);
    }
  };

  const applyQuickFilter = (type: string) => {
    if (type === "lt50") {
      setMaxPatients("49");
      setMinPatients("");
    } else if (type === "gt50") {
      setMinPatients("50");
      setMaxPatients("");
    } else if (type === "clear") {
      setSearch("");
      setMinPatients("");
      setMaxPatients("");
      setMinAvgTime("");
      setMaxAvgTime("");
    }
  };

  const activeSession = sessions.find((s) => s.is_active);
  // When searching, we can optionally show active sessions in the results or just past. We'll show all matching that aren't active.
  const pastSessions = sessions.filter((s) => !s.is_active);

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  // Shared compact card renderer
  const SessionCard = ({ session, isActive = false }: { session: any, isActive?: boolean }) => (
    <Link 
      href={`/console/sessions/${session.slug}`}
      className={clsx(
        "group rounded-xl border p-4 transition-all block relative overflow-hidden",
        isActive 
          ? "bg-emerald-50 border-emerald-300 shadow-sm shadow-emerald-500/10 hover:border-emerald-400" 
          : "bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm"
      )}
    >
      {isActive && (
        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
          Live
        </div>
      )}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center space-x-1.5 text-slate-700">
          <Calendar className={clsx("w-3.5 h-3.5", isActive ? "text-emerald-600" : "")} />
          <span className="font-semibold text-sm">{formatDate(session.session_date)}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className={clsx("p-2 rounded-lg", isActive ? "bg-emerald-100/50" : "bg-slate-50")}>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Patients</p>
          <div className="flex items-center space-x-1.5 text-slate-900 mt-0.5">
            <Users className={clsx("w-3.5 h-3.5", isActive ? "text-emerald-600" : "text-slate-400")} />
            <span className="font-bold text-sm">{session.total_tokens_done}</span>
          </div>
        </div>
        <div className={clsx("p-2 rounded-lg", isActive ? "bg-emerald-100/50" : "bg-slate-50")}>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Avg Time</p>
          <div className="flex items-center space-x-1.5 text-slate-900 mt-0.5">
            <Clock className={clsx("w-3.5 h-3.5", isActive ? "text-blue-600" : "text-slate-400")} />
            <span className="font-bold text-sm">{formatTime(session.avg_consult_secs)}</span>
          </div>
        </div>
      </div>
      
      {/* Subtle hover background decoration */}
      <div className={clsx(
        "absolute -bottom-2 -right-2 transition-opacity",
        isActive ? "text-emerald-500/10" : "text-slate-100 opacity-0 group-hover:opacity-100"
      )}>
        <Calendar className="w-16 h-16" />
      </div>
    </Link>
  );

  return (
    <div className="p-4 sm:p-6 w-full h-full flex flex-col relative pb-32">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Queue Sessions</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage today's live queue and view past sessions.</p>
        </div>
        {!activeSession && (
          <button 
            onClick={handleStartSession}
            disabled={isStarting}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-400 rounded-xl transition-all font-medium shadow-sm text-sm"
          >
            {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span className="hidden sm:inline">{isStarting ? "Starting..." : "Start Today's Session"}</span>
            <span className="inline sm:hidden">Start</span>
          </button>
        )}
      </div>

      {activeSession && !search && !minPatients && !maxPatients && !minAvgTime && !maxAvgTime && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wide mb-3">Active Now</h3>
          <div className="w-full sm:w-64">
            <SessionCard session={activeSession} isActive={true} />
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
          
          {/* Search Bar */}
          <div className="relative w-full xl:max-w-md shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by date (12), month (Aug), year (2023)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-all"
            />
          </div>

          {/* Quick Filters & Toggle */}
          <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 hide-scrollbar shrink-0">
            <button 
              onClick={() => applyQuickFilter("lt50")}
              className="whitespace-nowrap px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
            >
              &lt; 50 Patients
            </button>
            <button 
              onClick={() => applyQuickFilter("gt50")}
              className="whitespace-nowrap px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
            >
              &gt; 50 Patients
            </button>
            <div className="h-6 w-px bg-slate-300 mx-1 hidden sm:block"></div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                "flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border",
                showFilters || minPatients || maxPatients || minAvgTime || maxAvgTime
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Custom Filters</span>
            </button>
            {(search || minPatients || maxPatients || minAvgTime || maxAvgTime) && (
              <button 
                onClick={() => applyQuickFilter("clear")}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors shrink-0"
                title="Clear all filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Custom Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in slide-in-from-top-2 opacity-100 duration-200">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Patients Served</label>
              <div className="flex items-center space-x-2">
                <input 
                  type="number" 
                  placeholder="Min" 
                  value={minPatients}
                  onChange={(e) => setMinPatients(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-slate-400">-</span>
                <input 
                  type="number" 
                  placeholder="Max" 
                  value={maxPatients}
                  onChange={(e) => setMaxPatients(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Avg Consult Time (Seconds)</label>
              <div className="flex items-center space-x-2">
                <input 
                  type="number" 
                  placeholder="Min" 
                  value={minAvgTime}
                  onChange={(e) => setMinAvgTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-slate-400">-</span>
                <input 
                  type="number" 
                  placeholder="Max" 
                  value={maxAvgTime}
                  onChange={(e) => setMaxAvgTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>{search || minPatients || maxPatients || minAvgTime || maxAvgTime ? "Search Results" : "Past Sessions"}</span>
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </h3>
        {sessions.length === 0 && !isLoading ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
            <p className="text-slate-400 text-sm">No sessions match your search criteria.</p>
          </div>
        ) : (
          <div className={clsx("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 transition-opacity duration-200", isLoading ? "opacity-50" : "opacity-100")}>
            {pastSessions.map((session) => (
              <SessionCard key={session.slug} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
