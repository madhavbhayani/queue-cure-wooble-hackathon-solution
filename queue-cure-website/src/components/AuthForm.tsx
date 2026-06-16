"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Building2, Phone, Lock, MapPin, Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";
import { useRouter } from "next/navigation";

export default function AuthForm() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  
  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [address, setAddress] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);

  const isWeakPin = (pin: string) => {
    if (pin.length !== 8) return true;
    if (/^(\d)\1{7}$/.test(pin)) return true;
    const isAscending = "0123456789".includes(pin) || "1234567890".includes(pin);
    const isDescending = "9876543210".includes(pin) || "0987654321".includes(pin);
    if (isAscending || isDescending) return true;
    if (/^(\d{2})\1{3}$/.test(pin)) return true;
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{10}$/.test(phone)) {
      toast.error("Phone number must be exactly 10 digits without country code.");
      return;
    }

    if (!/^\d{8}$/.test(pin)) {
      toast.error("PIN must be exactly 8 digits.");
      return;
    }

    if (isWeakPin(pin)) {
      toast.error("PIN is too weak. Avoid simple patterns like 11111111 or 12345678.");
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const response = await authService.login(phone, pin);
        localStorage.setItem("token", response.token);
        toast.success(`Welcome back, ${response.clinic.name}!`);
        router.push('/console/sessions');
      } else {
        if (!name || !address) {
          toast.error("Clinic Name and Address are required.");
          setIsLoading(false);
          return;
        }
        await authService.signup({ name, phone, pin, address });
        toast.success("Clinic registered successfully!");
        
        // Refresh page to reset state and show login form as requested
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error: any) {
      // Extract error message thrown by our backend
      const message = error.response?.data?.error || "Connection to server failed.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const formVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length <= 10) setPhone(val);
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length <= 8) setPin(val);
  };

  return (
    <div className="w-full flex flex-col h-full justify-center py-4 sm:py-0">
      <div className="mb-4 sm:mb-6">
        <div className="inline-flex items-center justify-center p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl mb-4">
          <Activity className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-1.5 tracking-tight">
          {isLogin ? "Welcome back" : "Register Clinic"}
        </h1>
        <p className="text-slate-500 text-sm sm:text-lg">
          {isLogin
            ? "Enter your details to manage your clinic queue."
            : "Set up your clinic and eliminate waiting rooms forever."}
        </p>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.form
            key={isLogin ? "login" : "register"}
            variants={formVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="space-y-3 sm:space-y-4"
          >
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Clinic Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Patel General Clinic"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Phone Number (10 digits)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="9876543210"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Receptionist PIN (8 digits)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={pin}
                  onChange={handlePinChange}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 tracking-widest"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Clinic Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <textarea
                    required
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Health Ave, Medical District..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full group bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-3.5 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/30"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? "Sign In" : "Create Clinic"}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </motion.form>
        </AnimatePresence>

        <div className="mt-5 sm:mt-6 text-center text-slate-500 text-xs sm:text-sm">
          {isLogin ? "Don't have a clinic registered?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setName("");
              setPhone("");
              setPin("");
              setAddress("");
            }}
            className="text-emerald-600 font-medium hover:text-emerald-700 transition-colors focus:outline-none"
          >
            {isLogin ? "Register now" : "Sign in here"}
          </button>
        </div>
      </div>
    </div>
  );
}
