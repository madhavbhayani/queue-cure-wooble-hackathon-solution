import AuthForm from "@/components/AuthForm";
import FeaturesShowcase from "@/components/FeaturesShowcase";

export default function Home() {
  return (
    <main className="flex min-h-screen bg-slate-50 selection:bg-emerald-200">
      <div className="w-full flex">
        {/* Left Side: Auth */}
        <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-12 lg:p-16 xl:p-24 bg-slate-50 relative z-10 overflow-y-auto">
          <div className="w-full max-w-md my-auto">
            <AuthForm />
          </div>
        </div>

        {/* Right Side: Features & Animations */}
        <div className="hidden lg:flex lg:w-[55%] bg-slate-900 relative items-center justify-center p-12 overflow-hidden border-l border-slate-800">
          {/* Subtle noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.015] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none"></div>
          
          <FeaturesShowcase />
        </div>
      </div>
    </main>
  );
}
