"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { setAuth } from "@/lib/auth";

type ModalStep = "closed" | "login" | "otp";

// Lucide shapes drawn inline (home, info, settings)
function NavIcon({ name }: { name: "home" | "info" | "settings" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "home" && (
        <>
          <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
          <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </>
      )}
      {name === "info" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </>
      )}
      {name === "settings" && (
        <>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

// Friendly line icons for the landing sections (Lucide shapes drawn inline)
type IconName = "phone" | "radar" | "box" | "scanner" | "bell" | "key" | "checklist";

function SectionIcon({ name, size = 32 }: { name: IconName; size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "phone" && (
        <>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" />
        </>
      )}
      {name === "radar" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 12 19 5" />
        </>
      )}
      {name === "box" && (
        <>
          <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
          <path d="m3 8 9 5 9-5" />
          <path d="M12 13v8" />
        </>
      )}
      {name === "scanner" && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </>
      )}
      {name === "bell" && (
        <>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </>
      )}
      {name === "key" && (
        <>
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="m21 2-9.6 9.6" />
          <path d="m15.5 7.5 3 3L22 7l-3-3" />
        </>
      )}
      {name === "checklist" && (
        <>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="m9 14 2 2 4-4" />
        </>
      )}
    </svg>
  );
}

// The five steps of "How It Works": pointer color, number circle, icon tint
const STEPS: {
  title: string;
  text: string;
  icon: IconName;
  bar: string;
  circle: string;
  iconBox: string;
}[] = [
  {
    title: "Report with a Photo",
    text: "A student submits a lost or found item report with a required photo. The system checks image quality and content, then the AI pre-fills details like category, color, and fine features such as scratches or stickers.",
    icon: "scanner",
    bar: "bg-blue-500",
    circle: "bg-blue-600 text-white",
    iconBox: "bg-blue-50 text-blue-600",
  },
  {
    title: "AI-Powered Matching",
    text: "As soon as a report is saved, the AI automatically compares it against existing records in both directions: new lost reports against approved found items, and newly approved found items against active lost reports, flagging matches above the confidence threshold.",
    icon: "radar",
    bar: "bg-yellow-400",
    circle: "bg-yellow-400 text-[#09301B]",
    iconBox: "bg-yellow-50 text-yellow-600",
  },
  {
    title: "Instant Notification",
    text: "The student is notified the moment a likely match is found, so there's no need to keep checking the office in person or wait for an announcement.",
    icon: "bell",
    bar: "bg-red-500",
    circle: "bg-red-500 text-white",
    iconBox: "bg-red-50 text-red-600",
  },
  {
    title: "Five-Layer Claim Verification",
    text: "Before releasing any item, an administrator reviews verified student identity, submitted evidence, the AI similarity score, and secret question results. No single factor decides ownership on its own.",
    icon: "key",
    bar: "bg-indigo-500",
    circle: "bg-indigo-600 text-white",
    iconBox: "bg-indigo-50 text-indigo-600",
  },
  {
    title: "Item Returned & Logged",
    text: "Once ownership is confirmed, the item is marked as returned and the full transaction, including evidence, scores, and the approving admin, is permanently stored in a tamper-evident audit trail.",
    icon: "checklist",
    bar: "bg-yellow-400",
    circle: "bg-yellow-400 text-[#09301B]",
    iconBox: "bg-yellow-50 text-yellow-600",
  },
];

export default function Home() {
  const [step, setStep] = useState<ModalStep>("closed");

  function loadDraft() {
    if (typeof window === "undefined") return { identifier: "", password: "", rememberMe: false };
    try {
      const remembered = localStorage.getItem("findnest_remember_me") === "true";
      if (!remembered) return { identifier: "", password: "", rememberMe: false };
      const draft = localStorage.getItem("findnest_login_draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        return { identifier: parsed.identifier || "", password: parsed.password || "", rememberMe: true };
      }
    } catch (err) {
      console.error("Failed to restore login draft:", err);
    }
    return { identifier: "", password: "", rememberMe: false };
  }

  const [identifier, setIdentifier] = useState(() => loadDraft().identifier);
  const [password, setPassword] = useState(() => loadDraft().password);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => loadDraft().rememberMe);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        const fresh = loadDraft();
        setIdentifier(fresh.identifier);
        setPassword(fresh.password);
        setRememberMe(fresh.rememberMe);
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  function closeModal() {
    setStep("closed");
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setOtpError("");
    setShowPassword(false);
  }

  useEffect(() => {
    if (step !== "closed") {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
    };
  }, [step]);

  useEffect(() => {
    try {
      if (rememberMe) {
        localStorage.setItem("findnest_login_draft", JSON.stringify({ identifier, password }));
        localStorage.setItem("findnest_remember_me", "true");
      } else {
        localStorage.removeItem("findnest_login_draft");
        localStorage.removeItem("findnest_remember_me");
      }
    } catch (err) {
      console.error("Failed to save login draft:", err);
    }
  }, [identifier, password, rememberMe]);

  function openLogin() {
    closeModal();
    setStep("login");
  }

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  function redirectByRole(role: string) {
    if (role === "super_admin") window.location.href = "/user-management";
    else if (role === "admin") window.location.href = "/dashboard";
    else window.location.href = "/student-home";
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/login", { identifier: identifier.trim(), password });
      if (response.data.requires_otp) {
        setMaskedEmail(response.data.email);
        setStep("otp");
        startResendTimer();
      } else {
        setAuth(response.data.token, response.data.user);
        redirectByRole(response.data.user.role);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      document.getElementById(`landing-otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`landing-otp-${index - 1}`)?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setOtpError("Please enter all 6 digits");
      return;
    }
    setOtpError("");
    setOtpLoading(true);
    try {
      const response = await api.post("/auth/student/verify-otp", { school_id: identifier.trim(), otp: otpCode });
      setAuth(response.data.token, response.data.user);
      window.location.href = "/student-home";
    } catch (err: any) {
      setOtpError(err.response?.data?.message || "Invalid OTP code");
      setOtp(["", "", "", "", "", ""]);
      document.getElementById("landing-otp-0")?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    try {
      await api.post("/auth/student/resend-otp", { school_id: identifier.trim() });
      startResendTimer();
      setOtp(["", "", "", "", "", ""]);
      setOtpError("");
    } catch (err: any) {
      setOtpError("Failed to resend code. Please try again.");
    }
  };

  return (
    <main className="relative min-h-screen bg-[#F8FAF7] font-sans overflow-x-hidden scroll-smooth">

      {step === "login" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md">
          {/* [UI] max-h + scroll so the card is never cut off on short screens */}
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none">&times;</button>

            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-[#0D5C3A]">Welcome Back</h2>
              <p className="text-[#64748B] text-sm mt-1">Sign in with your email or Student ID</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
              <fieldset disabled={loading} className="space-y-4 min-w-0 border-0 p-0 m-0">
              <div>
                <label className="block text-sm font-semibold text-[#383838] mb-2 font-[family-name:var(--font-kanit)]">Email or Student ID</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@email.com or 00000001"
                  autoComplete="off"
                  name="fnd-user-field"
                  maxLength={50}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4ADE80] focus:outline-none transition text-gray-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#383838] mb-2 font-[family-name:var(--font-kanit)]">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="new-password"
                    name="fnd-pass-field"
                    maxLength={50}
                    className="w-full pl-4 pr-12 py-3 font-[family-name:var(--font-inter)] border-2 border-gray-200 rounded-xl focus:border-[#4ADE80]focus:outline-none transition text-gray-700"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0D5C3A] transition text-xs font-bold">
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-[#0D5C3A] cursor-pointer"
                />
                <span className="text-sm text-gray-600 font-medium">Remember Me</span>
              </label>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm text-center">{error}</div>}
              <button type="submit" disabled={loading} className="font-[family-name:var(--font-inter)] w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold py-3.5 rounded-xl transition shadow-lg disabled:opacity-50">
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <div className="text-center">
                <a href="/forgot-password" className="text-[#0D5C3A] hover:text-[#16A34A] text-sm transition font-medium">Forgot Password?</a>
              </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {step === "otp" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none">&times;</button>

            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-[#0D5C3A]">Check Your Email</h2>
              <p className="text-[#64748B] text-sm mt-1">We sent a 6-digit code to</p>
              <p className="text-[#0D5C3A] font-bold text-sm mt-1">{maskedEmail}</p>
            </div>

            <div className="space-y-5">
              <div className="flex gap-2 justify-center">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`landing-otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-11 h-13 text-center text-xl font-black border-2 border-gray-200 rounded-xl focus:border-[#4ADE80] focus:outline-none transition text-gray-700"
                  />
                ))}
              </div>
              {otpError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm text-center">{otpError}</div>}
              <button onClick={handleVerifyOtp} disabled={otpLoading} className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-black py-3.5 rounded-xl transition shadow-lg disabled:opacity-50">
                {otpLoading ? "Verifying..." : "Verify OTP"}
              </button>
              <div className="text-center">
                <button onClick={handleResendOtp} disabled={resendTimer > 0} className="text-sm font-bold text-[#0D5C3A] disabled:text-gray-400 hover:underline transition">
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Code"}
                </button>
              </div>
              <div className="text-center">
                <button onClick={() => setStep("login")} className="text-[#0D5C3A] hover:text-[#16A34A] text-sm transition font-medium">&larr; Back to Login</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating glass navbar */}
            <nav className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-screen-2xl flex items-center justify-between px-4 sm:px-6 py-3 rounded-full backdrop-blur-md bg-white/70 shadow-sm border border-white/50">
        <a href="#top" className="flex items-center gap-2 hover:opacity-80 transition">
          <Image src="/images/findnest-logo.png" alt="FindNest logo" width={36} height={36} className="rounded-lg" />
          <span className="text-xl font-black text-[#0D5C3A] tracking-wide">FINDNEST</span>
        </a>
        <div className="flex items-center gap-3 sm:gap-8">
          <a href="#top" className="hidden md:inline-flex items-center gap-2 text-[#0D5C3A]/80 hover:text-[#0D5C3A] transition-all duration-300 font-semibold text-sm tracking-wide"><NavIcon name="home" />HOME</a>
          <a href="#about" className="hidden md:inline-flex items-center gap-2 text-[#0D5C3A]/80 hover:text-[#0D5C3A] transition-all duration-300 font-semibold text-sm tracking-wide"><NavIcon name="info" />ABOUT FINDNEST</a>
          <a href="#how-it-works" className="hidden md:inline-flex items-center gap-2 text-[#0D5C3A]/80 hover:text-[#0D5C3A] transition-all duration-300 font-semibold text-sm tracking-wide"><NavIcon name="settings" />HOW IT WORKS</a>
          <button
            onClick={openLogin}
            className="font-[family-name:var(--font-inter)] bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold tracking-wide px-5 sm:px-7 py-2.5 rounded-full shadow-md text-sm transition-all duration-300 cursor-pointer"
          >
            LOG IN
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-28 pb-16 bg-gradient-to-b from-[#F8FAF7] to-[#EEF5EC]">
        {/* Glowing orbs and the forest green semi-circle */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute top-24 left-10 w-72 h-72 rounded-full bg-[#86EFAC]/30 blur-3xl" />
          <div className="absolute bottom-10 left-1/3 w-80 h-80 rounded-full bg-[#4ADE80]/20 blur-3xl" />
          <div className="absolute top-1/3 right-1/3 w-5 h-5 rounded-full bg-[#4ADE80]/60" />
          <div className="absolute bottom-1/4 left-12 w-3 h-3 rounded-full bg-[#0D5C3A]/30" />
          <div className="hidden lg:block absolute -top-40 -right-40 w-[520px] h-[520px] xl:w-[640px] xl:h-[640px] rounded-full bg-gradient-to-br from-[#0D5C3A] to-[#09301B]" />
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-14 px-6 md:px-12 xl:px-20 w-full max-w-screen-2xl mx-auto items-center">

          {/* Left content */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#DCFCE7] text-[#15803D] rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse" />
              <span className="text-sm font-semibold">AI-Powered Lost &amp; Found System</span>
            </div>

            <h1 className="text-4xl md:text-5xl xl:text-6xl font-black uppercase leading-[1.05] mb-6 text-[#0D5C3A]">
              Never Lose
              <span className="block text-[#4ADE80]">What Matters</span>
              Most.
            </h1>

            <p className="text-gray-600 text-lg mb-10 leading-relaxed max-w-md">
              FindNest uses advanced AI image recognition to match lost and found items on campus. Submit a report, get notified instantly.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <button
                onClick={openLogin}
                className="bg-[#C82333] hover:bg-[#A71D2A] text-white font-bold px-8 py-4 rounded-full shadow-xl shadow-red-500/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                Report Lost Item
              </button>
              <button
                onClick={openLogin}
                className="bg-white hover:bg-[#F3FAF6] border border-[#0D5C3A] text-[#0D5C3A] font-bold px-8 py-4 rounded-full hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                Found Something?
              </button>
            </div>

            <div className="flex flex-wrap gap-6 md:gap-10">
              <div>
                <p className="text-3xl font-black text-[#0D5C3A]">675+</p>
                <p className="text-gray-500 text-sm">Students</p>
              </div>
              <div className="w-px bg-[#0D5C3A]/15" />
              <div>
                <p className="text-3xl font-black text-[#0D5C3A]">AI</p>
                <p className="text-gray-500 text-sm">Powered Matching</p>
              </div>
              <div className="w-px bg-[#0D5C3A]/15" />
              <div>
                <p className="text-3xl font-black text-[#0D5C3A]">24/7</p>
                <p className="text-gray-500 text-sm">Real-Time Alerts</p>
              </div>
            </div>
          </div>

          {/* Right visual stack */}
          <div className="relative flex justify-center py-6">
            <div className="absolute inset-x-6 inset-y-0 sm:inset-x-14 rotate-6 rounded-3xl bg-white/40 backdrop-blur-xl border border-white/60 shadow-lg" />

            <div className="relative w-full max-w-[19rem] bg-white rounded-[2.5rem] border-[6px] border-[#0B2A1B] shadow-2xl shadow-[#0D5C3A]/25 px-5 pt-5 pb-6 -rotate-2">
              <div className="mx-auto mb-4 w-20 h-1.5 rounded-full bg-[#0B2A1B]/80" />
              <div className="flex flex-col items-center">
                <Image
                  src="/images/findnest-logo.png"
                  alt="FindNest Logo"
                  width={110}
                  height={104}
                  className="rounded-2xl mb-2"
                  priority
                />
                <h3 className="text-[#0D5C3A] font-black text-sm text-center">SJDM Cornerstone College Inc.</h3>
              </div>

              <div className="space-y-2.5 mt-4">
                <div className="bg-[#E8F5E9] rounded-2xl p-3">
                  <p className="text-[#0D5C3A] text-sm font-bold">AI Image Matching</p>
                  <p className="text-[#2E7D32] text-xs leading-snug">Smart item recognition to speed up recovery.</p>
                </div>
                <div className="bg-[#E8F5E9] rounded-2xl p-3">
                  <p className="text-[#0D5C3A] text-sm font-bold">Instant Notifications</p>
                  <p className="text-[#2E7D32] text-xs leading-snug">Real-time alerts when a match is found.</p>
                </div>
                <div className="bg-[#E8F5E9] rounded-2xl p-3">
                  <p className="text-[#0D5C3A] text-sm font-bold">Claim Verification</p>
                  <p className="text-[#2E7D32] text-xs leading-snug">5-layer check against fraudulent claims.</p>
                </div>
              </div>
            </div>

            {/* Floating glass badge */}
            <div className="absolute right-0 sm:-right-4 top-1/2 flex items-center gap-3 bg-white/80 backdrop-blur-md shadow-lg rounded-2xl px-4 py-3 border border-white/70">
              <div className="w-9 h-9 rounded-full bg-[#22C55E] text-white flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <div>
                <p className="text-[#0D5C3A] text-sm font-black leading-tight">Match Found!</p>
                <p className="text-gray-500 text-xs">Owner Notified!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Process: three soft cards with friendly icons */}
      <section className="px-4 sm:px-8 xl:px-20 py-16 md:py-24 bg-[#F9FBF7] relative">
        <div className="text-center mb-16">
          <span className="text-[#2E7D32] font-bold text-sm uppercase tracking-widest">The Process</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0D5C3A] mt-2 mb-4">How FindNest Works</h2>
          <p className="text-gray-600 text-lg max-w-xl mx-auto">A smarter way to manage lost and found items on campus</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-screen-2xl mx-auto">
          <div className="relative text-center p-8 xl:p-12 rounded-2xl bg-[#E8F5E9]/80 backdrop-blur border border-[#0D5C3A]/10 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <span className="absolute top-5 right-6 text-5xl font-black text-[#0D5C3A]/10">01</span>
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-white/80 text-[#0D5C3A] flex items-center justify-center shadow-sm">
              <SectionIcon name="phone" />
            </div>
            <h3 className="font-black text-[#0D5C3A] text-xl mb-3">Submit a Report</h3>
            <p className="text-gray-600 leading-relaxed">Upload a photo of a lost or found item. Our AI automatically detects item details.</p>
          </div>

          <div className="relative text-center p-8 xl:p-12 rounded-2xl bg-[#FEF9C3]/80 backdrop-blur border border-yellow-500/20 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <span className="absolute top-5 right-6 text-5xl font-black text-[#0D5C3A]/10">02</span>
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-white/80 text-amber-600 flex items-center justify-center shadow-sm">
              <SectionIcon name="radar" />
            </div>
            <h3 className="font-black text-[#0D5C3A] text-xl mb-3">AI Finds a Match</h3>
            <p className="text-gray-600 leading-relaxed">Our AI engine compares your report against all found items and finds potential matches instantly.</p>
          </div>

          <div className="relative text-center p-8 xl:p-12 rounded-2xl bg-[#FCE7F3]/80 backdrop-blur border border-pink-400/20 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <span className="absolute top-5 right-6 text-5xl font-black text-[#0D5C3A]/10">03</span>
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-white/80 text-pink-600 flex items-center justify-center shadow-sm">
              <SectionIcon name="box" />
            </div>
            <h3 className="font-black text-[#0D5C3A] text-xl mb-3">Claim Your Item</h3>
            <p className="text-gray-600 leading-relaxed">Go through our secure 5-layer verification process and claim your belongings from the school office.</p>
          </div>
        </div>
      </section>

      {/* About FindNest: floating shapes and three tinted cards */}
      <section id="about" className="relative px-4 sm:px-8 xl:px-20 pb-16 md:pb-24 pt-4 bg-[#F9FBF7] scroll-mt-24 overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute top-8 left-6 w-14 h-14 rounded-full bg-[#86EFAC]/40" />
          <div className="absolute top-1/3 right-8 w-10 h-10 rounded-full bg-[#86EFAC]/30" />
          <div className="absolute bottom-10 left-1/4 w-8 h-8 rounded-full bg-[#4ADE80]/25" />
          <svg className="absolute top-16 right-1/4 w-9 h-9 text-[#FACC15]/60" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,3 22,21 2,21" /></svg>
          <svg className="absolute bottom-1/4 right-10 w-7 h-7 text-[#FACC15]/50 rotate-12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,3 22,21 2,21" /></svg>
          <svg className="absolute bottom-16 left-10 w-6 h-6 text-[#FACC15]/50 -rotate-12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,3 22,21 2,21" /></svg>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <span className="text-[#2E7D32] font-bold text-sm uppercase tracking-widest">Who We Are</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0D5C3A] mt-2 mb-6">About FindNest</h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-10">
            FindNest is a multi-platform lost and found record management system built specifically
            for the Junior High School, Senior High School, and College programs of SJDM Cornerstone
            College Inc. It replaces the school&apos;s manual, logbook-based process with a digital
            solution that uses AI-powered image recognition and description-based matching to help
            students recover their belongings faster and with less hassle.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-[#E8F5E9]/70 rounded-2xl p-6 border border-[#0D5C3A]/15 hover:-translate-y-1 transition-all duration-300">
              <h3 className="font-black text-[#0D5C3A] mb-2">Our Purpose</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                To modernize the campus lost and found process with photo documentation, real-time
                tracking, and a searchable digital record for every reported item.
              </p>
            </div>

            <div className="bg-[#FEF9C3]/70 rounded-2xl p-6 border border-yellow-500/25 hover:-translate-y-1 transition-all duration-300">
              <h3 className="font-black text-[#0D5C3A] mb-2">Trust &amp; Security</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                A five-layer claim verification process protects students from fraudulent claims and
                ensures every recovered item goes back to its rightful owner.
              </p>
            </div>

            <div className="bg-[#FCE7F3]/70 rounded-2xl p-6 border border-pink-400/25 hover:-translate-y-1 transition-all duration-300">
              <h3 className="font-black text-[#0D5C3A] mb-2">Built for SJDM</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Designed around the real needs of SJDM Cornerstone College Inc., gathered through
                direct surveys and interviews with students and school personnel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Step by Step: horizontal cards with a colored pointer and an icon at the end */}
      <section id="how-it-works" className="px-4 sm:px-8 xl:px-20 py-16 md:py-24 bg-gradient-to-b from-white to-[#F3F4F6] scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#2E7D32] font-bold text-sm uppercase tracking-widest">Step by Step</span>
            <h2 className="text-3xl md:text-4xl font-black text-[#0D5C3A] mt-2 mb-4">How It Works</h2>
            <p className="text-gray-600 text-lg max-w-xl mx-auto">
              Here&apos;s a closer look at how FindNest takes an item from &quot;lost&quot; to &quot;returned&quot;.
            </p>
          </div>

          <div className="space-y-6">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className="relative flex items-center gap-4 sm:gap-6 bg-white rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 p-5 sm:p-6 pl-7 sm:pl-8"
              >
                <span aria-hidden="true" className={`absolute left-0 top-4 bottom-4 w-1.5 rounded-full ${s.bar}`} />
                <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black ${s.circle}`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-[#0D5C3A] mb-1">{s.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{s.text}</p>
                </div>
                <div className={`hidden sm:flex w-14 h-14 shrink-0 rounded-2xl items-center justify-center ${s.iconBox}`}>
                  <SectionIcon name={s.icon} size={28} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Last call to action and footer share one deep green gradient */}
      <div className="bg-gradient-to-b from-[#09301B] to-[#0A1E12]">
        <section className="relative px-4 sm:px-8 xl:px-20 py-16 md:py-24 overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] rounded-full bg-[#22C55E]/20 blur-3xl" />
          <div className="relative text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 drop-shadow-[0_0_24px_rgba(74,222,128,0.45)]">Lost Something on Campus?</h2>
            <p className="text-emerald-100/80 text-lg mb-10">Report it now and let our AI do the work for you.</p>
            <button
              onClick={openLogin}
              className="inline-flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] text-black font-black px-10 py-4 rounded-full shadow-xl hover:-translate-y-0.5 text-lg transition-all duration-300 cursor-pointer"
            >
              Get Started Now <span aria-hidden="true">&#10140;</span>
            </button>
          </div>
        </section>

        <footer className="px-8 pb-14 pt-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3">
              <Image src="/images/findnest-logo.png" alt="FindNest logo" width={44} height={44} className="rounded-xl" />
              <span className="text-2xl font-black text-white tracking-wide">
                FIND<span className="text-[#FACC15]">NEST</span>
              </span>
            </div>
            <p className="text-emerald-100/70 text-sm leading-relaxed mt-4 max-w-lg mx-auto">
              A Multi-Platform Lost &amp; Found Record Management System with Image Recognition &amp; Description Based Matching and Claim Verification for San Jose Del Monte Cornerstone College Inc.
            </p>

            <div className="flex items-center justify-center gap-8 mt-8 flex-wrap">
              <a
                href="https://www.facebook.com/sjdmcci.2023"
                className="text-emerald-100/80 text-sm hover:text-white transition-all duration-300 font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
              </a>
              <span className="text-emerald-100/80 text-sm font-medium">0917 700 4758</span>
              <span className="text-emerald-100/80 text-sm font-medium">sjdmcornerstonecollege.inc@gmail.com</span>
            </div>

            <div className="border-t border-white/10 mt-8 pt-6">
              <p className="text-emerald-100/60 text-sm">© 2026 FindNest — SJDM Cornerstone College Inc. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}