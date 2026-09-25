"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { setAuth } from "@/lib/auth";

type ModalStep = "closed" | "login" | "otp";

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
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
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
    <main className="min-h-screen bg-[#fafbff] font-sans overflow-x-hidden scroll-smooth">

      {step === "login" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none">&times;</button>

            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-[#1a237e]">Welcome Back</h2>
              <p className="text-gray-400 text-sm mt-1">Sign in with your email or Student ID</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">Email or Student ID</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@email.com or 00000001"
                  autoComplete="off"
                  name="fnd-user-field"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="new-password"
                    name="fnd-pass-field"
                    className="w-full pl-4 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1a237e] transition text-xs font-bold">
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-[#1a237e] cursor-pointer"
                />
                <span className="text-sm text-gray-600 font-medium">Remember Me</span>
              </label>
              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm text-center">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-[#1a237e] hover:bg-[#283593] text-white font-black py-3.5 rounded-xl transition shadow-lg disabled:opacity-50">
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <div className="text-center">
                <a href="/forgot-password" className="text-gray-400 hover:text-[#1a237e] text-sm transition font-medium">Forgot Password?</a>
              </div>
            </form>
          </div>
        </div>
      )}

      {step === "otp" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none">&times;</button>

            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-red-500">Check Your Email</h2>
              <p className="text-gray-400 text-sm mt-1">We sent a 6-digit code to</p>
              <p className="text-red-500 font-bold text-sm mt-1">{maskedEmail}</p>
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
                    className="w-11 h-13 text-center text-xl font-black border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition text-gray-700"
                  />
                ))}
              </div>
              {otpError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm text-center">{otpError}</div>}
              <button onClick={handleVerifyOtp} disabled={otpLoading} className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-3.5 rounded-xl transition shadow-lg disabled:opacity-50">
                {otpLoading ? "Verifying..." : "Verify OTP"}
              </button>
              <div className="text-center">
                <button onClick={handleResendOtp} disabled={resendTimer > 0} className="text-sm font-bold text-red-500 disabled:text-gray-400 hover:underline transition">
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Code"}
                </button>
              </div>
              <div className="text-center">
                <button onClick={() => setStep("login")} className="text-gray-400 hover:text-red-500 text-sm transition font-medium">&larr; Back to Login</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-4 bg-[#1a237e]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <a href="/" className="text-xl font-black text-white tracking-wide hover:opacity-80 transition">
            FIND<span className="text-[#ffd700]">NEST</span>
          </a>
        </div>
        <div className="flex items-center gap-10">
          <a href="/" className="text-blue-200 hover:text-[#ffd700] transition font-medium text-sm tracking-wide">HOME</a>
          <a href="#about" className="text-blue-200 hover:text-[#ffd700] transition font-medium text-sm tracking-wide">ABOUT FINDNEST</a>
          <a href="#how-it-works" className="text-blue-200 hover:text-[#ffd700] transition font-medium text-sm tracking-wide">HOW IT WORKS</a>
          <button
            onClick={openLogin}
            className="bg-[#ffd700] text-[#1a237e] font-bold px-6 py-2 rounded-full hover:bg-yellow-300 transition shadow-md text-sm"
          >
            LOG IN
          </button>
        </div>
      </nav>

      <section className="relative min-h-screen flex items-center overflow-hidden pt-20">

        <div className="absolute inset-0 bg-[#fafbff]" />
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-gradient-to-br from-[#1a237e] to-[#3949ab] rounded-full opacity-90" />
        <div className="absolute top-1/3 -right-10 w-80 h-80 bg-[#ffd700]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-full h-2/3 bg-gradient-to-t from-[#1a237e]/5 to-transparent" />
        <div className="absolute bottom-20 left-10 w-40 h-40 border-4 border-[#ffd700]/20 rounded-3xl rotate-12" />
        <div className="absolute top-40 left-1/3 w-6 h-6 bg-red-400 rounded-full" />
        <div className="absolute bottom-1/3 right-1/4 w-4 h-4 bg-[#ffd700] rounded-full" />

        <div className="relative z-10 grid grid-cols-2 gap-12 px-20 w-full items-center">

          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-[#1a237e]/10 shadow-sm rounded-full px-4 py-2 mb-6">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[#1a237e] text-sm font-semibold">AI-Powered Lost &amp; Found System</span>
            </div>

            <h1 className="text-6xl font-black text-[#1a237e] leading-[1.05] mb-6">
              Never Lose
              <span className="block bg-gradient-to-r from-[#ffd700] to-[#f59e0b] bg-clip-text text-transparent">What Matters</span>
              Most.
            </h1>

            <p className="text-gray-500 text-lg mb-10 leading-relaxed max-w-md">
              FindNest uses advanced AI image recognition to match lost and found items on campus. Submit a report, get notified instantly.
            </p>

            <div className="flex gap-4 mb-12">
              <button
                onClick={openLogin}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-4 rounded-2xl transition shadow-xl shadow-red-500/20 hover:-translate-y-1"
              >
                Report Lost Item
              </button>
              <button
                onClick={openLogin}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 border-2 border-[#1a237e]/10 text-[#1a237e] font-bold px-8 py-4 rounded-2xl transition hover:-translate-y-1"
              >
                Found Something?
              </button>
            </div>

            <div className="flex gap-10">
              <div>
                <p className="text-3xl font-black text-[#1a237e]">675+</p>
                <p className="text-gray-400 text-sm">Students</p>
              </div>
              <div className="w-px bg-gray-200" />
              <div>
                <p className="text-3xl font-black text-[#1a237e]">AI</p>
                <p className="text-gray-400 text-sm">Powered Matching</p>
              </div>
              <div className="w-px bg-gray-200" />
              <div>
                <p className="text-3xl font-black text-[#1a237e]">24/7</p>
                <p className="text-gray-400 text-sm">Real-Time Alerts</p>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="absolute -inset-6 bg-gradient-to-br from-[#ffd700]/30 to-transparent rounded-[2.5rem] rotate-3" />

            <div className="relative w-80 bg-white rounded-[2rem] p-8 shadow-2xl shadow-[#1a237e]/10 border border-gray-100 flex flex-col items-center -rotate-2">
              <Image
                src="/images/findnest-logo.svg"
                alt="FindNest Logo"
                width={170}
                height={160}
                className="rounded-2xl mb-4"
                priority
              />
              <h3 className="text-[#1a237e] font-black text-lg text-center">SJDM Cornerstone</h3>
              <p className="text-gray-600 text-sm text-center mb-6">College Inc.</p>

              <div className="space-y-3 w-full">
                <div className="flex items-center gap-3 bg-[#f5f7ff] rounded-xl p-3">
                  <div>
                    <p className="text-[#1a237e] text-sm font-semibold">AI Image Matching</p>
                    <p className="text-blue-600 text-xs">Smart item recognition to instantly identify lost items and accelerate the recovery process!</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[#f5f7ff] rounded-xl p-3">
                  <div>
                    <p className="text-[#1a237e] text-sm font-semibold">Instant Notifications</p>
                    <p className="text-blue-600 text-xs">Real-time push alerts to keep users immediately informed whenever a matching item is found!</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[#f5f7ff] rounded-xl p-3">
                  <div>
                    <p className="text-[#1a237e] text-sm font-semibold">Claim Verification</p>
                    <p className="text-blue-600 text-xs">5-layer security check to ensure authenticity and prevent fraudulent claims!</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-5 -right-5 bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg rotate-6">
              Match Found!
            </div>
            <div className="absolute -bottom-5 -left-5 bg-[#1a237e] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg -rotate-6">
              Owner Notified!
            </div>
          </div>
        </div>
      </section>

      <section className="px-20 py-24 bg-white relative">
        <div className="text-center mb-16">
          <span className="text-[#ffd700] font-bold text-sm uppercase tracking-widest">The Process</span>
          <h2 className="text-4xl font-black text-[#1a237e] mt-2 mb-4">How FindNest Works</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">A smarter way to manage lost and found items on campus</p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="group relative text-center p-20 rounded-3xl bg-[#f5f7ff] hover:bg-[#1a237e] transition-all duration-300">
            <span className="absolute top-6 right-6 text-5xl font-black text-[#1a237e]/10 group-hover:text-white/10">01</span>
            <h3 className="font-black text-[#1a237e] group-hover:text-white text-xl mb-3 transition">Submit a Report</h3>
            <p className="text-gray-500 group-hover:text-blue-200 leading-relaxed transition">Upload a photo of your lost or found item. Our AI automatically detects item details.</p>
          </div>

          <div className="group relative text-center p-20 rounded-3xl bg-[#fff9e6] hover:bg-[#ffd700] transition-all duration-300">
            <span className="absolute top-6 right-6 text-5xl font-black text-[#1a237e]/10 group-hover:text-[#1a237e]/20">02</span>
            <h3 className="font-black text-[#1a237e] text-xl mb-3">AI Finds a Match</h3>
            <p className="text-gray-500 leading-relaxed">Our AI engine compares your report against all found items and finds potential matches instantly.</p>
          </div>

          <div className="group relative text-center p-20 rounded-3xl bg-red-50 hover:bg-red-500 transition-all duration-300">
            <span className="absolute top-6 right-6 text-5xl font-black text-red-500/10 group-hover:text-white/10">03</span>
            <h3 className="font-black text-[#1a237e] group-hover:text-white text-xl mb-3 transition">Claim Your Item</h3>
            <p className="text-gray-500 group-hover:text-red-100 leading-relaxed transition">Go through our secure 5-layer verification process and claim your belongings from the school office.</p>
          </div>
        </div>
      </section>

      <section id="about" className="px-20 py-24 bg-[#f5f7ff] scroll-mt-24">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#ffd700] font-bold text-sm uppercase tracking-widest">Who We Are</span>
          <h2 className="text-4xl font-black text-[#1a237e] mt-2 mb-6">About FindNest</h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-10">
            FindNest is a multi-platform lost and found record management system built specifically
            for the Junior High School, Senior High School, and College programs of SJDM Cornerstone
            College Inc. It replaces the school&apos;s manual, logbook-based process with a digital
            solution that uses AI-powered image recognition and description-based matching to help
            students recover their belongings faster and with less hassle.
          </p>

          <div className="grid grid-cols-3 gap-6 text-left">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-[#1a237e] mb-2">Our Purpose</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                To modernize the campus lost and found process with photo documentation, real-time
                tracking, and a searchable digital record for every reported item.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-[#1a237e] mb-2">Trust &amp; Security</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                A five-layer claim verification process protects students from fraudulent claims and
                ensures every recovered item goes back to its rightful owner.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-[#1a237e] mb-2">Built for SJDM</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Designed around the real needs of SJDM Cornerstone College Inc., gathered through
                direct surveys and interviews with students and school personnel.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-20 py-24 bg-white scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#ffd700] font-bold text-sm uppercase tracking-widest">Step by Step</span>
            <h2 className="text-4xl font-black text-[#1a237e] mt-2 mb-4">How It Works</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Here&apos;s a closer look at how FindNest takes an item from &quot;lost&quot; to &quot;returned&quot;.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-6 items-start bg-[#f5f7ff] rounded-2xl p-6">
              <div className="w-10 h-10 shrink-0 bg-[#1a237e] text-white rounded-full flex items-center justify-center font-black">1</div>
              <div>
                <h3 className="font-black text-[#1a237e] mb-1">Report with a Photo</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  A student submits a lost or found item report with a required photo. The system
                  checks image quality and content, then the AI pre-fills details like category,
                  color, and fine features such as scratches or stickers.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start bg-[#fff9e6] rounded-2xl p-6">
              <div className="w-10 h-10 shrink-0 bg-[#ffd700] text-[#1a237e] rounded-full flex items-center justify-center font-black">2</div>
              <div>
                <h3 className="font-black text-[#1a237e] mb-1">AI-Powered Matching</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  As soon as a report is saved, the AI automatically compares it against existing
                  records in both directions — new lost reports against approved found items, and
                  newly approved found items against active lost reports — flagging matches above
                  the confidence threshold.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start bg-red-50 rounded-2xl p-6">
              <div className="w-10 h-10 shrink-0 bg-red-500 text-white rounded-full flex items-center justify-center font-black">3</div>
              <div>
                <h3 className="font-black text-[#1a237e] mb-1">Instant Notification</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  The student is notified the moment a likely match is found, so there&apos;s no need
                  to keep checking the office in person or wait for a flag ceremony announcement.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start bg-[#f5f7ff] rounded-2xl p-6">
              <div className="w-10 h-10 shrink-0 bg-[#1a237e] text-white rounded-full flex items-center justify-center font-black">4</div>
              <div>
                <h3 className="font-black text-[#1a237e] mb-1">Five-Layer Claim Verification</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Before releasing any item, an administrator reviews verified student identity,
                  submitted evidence, the AI similarity score, and secret question results — no
                  single factor decides ownership on its own.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start bg-[#fff9e6] rounded-2xl p-6">
              <div className="w-10 h-10 shrink-0 bg-[#ffd700] text-[#1a237e] rounded-full flex items-center justify-center font-black">5</div>
              <div>
                <h3 className="font-black text-[#1a237e] mb-1">Item Returned &amp; Logged</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Once ownership is confirmed, the item is marked as returned and the full
                  transaction — evidence, scores, and the approving admin — is permanently stored in
                  a tamper-evident audit trail.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-20 py-24 bg-[#1a237e] overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-[#ffd700]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-red-500/10 rounded-full blur-3xl" />
        <div className="relative text-center">
          <h2 className="text-4xl font-black text-white mb-4">Lost Something on Campus?</h2>
          <p className="text-blue-200 text-lg mb-10">Report it now and let our AI do the work for you.</p>
          <button
            onClick={openLogin}
            className="bg-[#ffd700] text-[#1a237e] font-black px-10 py-4 rounded-2xl hover:bg-yellow-300 transition shadow-xl text-lg"
          >
            Get Started Now
          </button>
        </div>
      </section>

      <footer className="bg-[#0d1757] px-8 py-14">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-2xl font-black text-white">
            FIND<span className="text-[#ffd700]">NEST</span>
          </span>
          <p className="text-blue-300 text-sm leading-relaxed mt-4 max-w-lg mx-auto">
            A Multi-Platform Lost &amp; Found Record Management System with Image Recognition &amp; Description Based Matching and Claim Verification for San Jose Del Monte Cornerstone College Inc.
          </p>

          <div className="flex items-center justify-center gap-8 mt-8 flex-wrap">
            <a
              href="https://www.facebook.com/sjdmcci.2023"
              className="text-blue-300 text-sm hover:text-white transition-colors font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook
            </a>
            <span className="text-blue-300 text-sm font-medium">0917 700 4758</span>
            <span className="text-blue-300 text-sm font-medium">sjdmcornerstonecollege.inc@gmail.com</span>
          </div>

          <div className="border-t border-white/10 mt-8 pt-6">
            <p className="text-blue-400 text-sm">© 2026 FindNest — SJDM Cornerstone College Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}