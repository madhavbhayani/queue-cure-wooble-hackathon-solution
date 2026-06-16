"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authService } from "@/services/auth.service";
import { Loader2, Activity, Ticket, Users, FileText, LogOut } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import clsx from "clsx";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("You must be logged in to access this page.");
        router.push("/");
        return;
      }

      try {
        await authService.verify();
        setIsVerified(true);
      } catch (error) {
        localStorage.removeItem("token");
        toast.error("Your session has expired. Please log in again.");
        router.push("/");
      }
    };

    verifySession();
  }, [router, pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  if (!isVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Verifying secure session...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "Sessions", path: "/console/sessions", icon: Activity },
    { name: "Tokens", path: "/console/tokens", icon: Ticket },
    { name: "Patients", path: "/console/patients", icon: Users },
    { name: "Logs", path: "/console/logs", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-slate-50 relative pb-28 w-full">
      {/* Main Content Area */}
      {children}

      {/* Floating Bottom Navigation Bar */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-auto">
        <div className="inline-flex items-center space-x-1 sm:space-x-2 bg-emerald-900/90 backdrop-blur-md px-2 py-2 rounded-[2rem] shadow-2xl shadow-emerald-900/20 border border-emerald-800/50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.path);

            return (
              <Link
                key={item.name}
                href={item.path}
                className={clsx(
                  "flex flex-col items-center justify-center space-y-1 w-[4rem] sm:w-[4.5rem] h-12 sm:h-14 rounded-[1.5rem] transition-all duration-300",
                  isActive 
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" 
                    : "text-emerald-100/70 hover:bg-emerald-800/50 hover:text-white"
                )}
              >
                <Icon className={clsx("w-5 h-5", isActive ? "animate-pulse" : "")} />
                <span className="text-[10px] sm:text-[11px] font-medium tracking-wide leading-none mt-1">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Global Floating Logout Button */}
      <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50">
        <button 
          onClick={handleLogout}
          className="flex items-center justify-center p-3 sm:px-4 sm:py-2.5 bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-full sm:rounded-[1.5rem] transition-all shadow-xl shadow-rose-500/10 hover:shadow-rose-500/20"
          title="Logout"
        >
          <LogOut className="w-5 h-5 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline sm:ml-2 font-medium text-sm">Logout</span>
        </button>
      </div>
    </div>
  );
}
