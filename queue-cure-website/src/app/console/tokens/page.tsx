"use client";

import { useRouter } from "next/navigation";

export default function TokensPage() {
  const router = useRouter();

  return (
    <div className="p-4 sm:p-6 w-full">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Queue Tokens</h1>
          <p className="text-slate-500 text-sm sm:text-base mt-1">Generate and manage tokens.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 p-4 sm:p-6 h-[60vh] flex items-center justify-center border-dashed">
        <p className="text-slate-400 text-base sm:text-lg">Token management interface will appear here.</p>
      </div>
    </div>
  );
}
