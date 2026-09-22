"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function StudentLoginPage() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"login" | "otp">("login");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    const forceLogoutIfSessionExists = async () => {
      const existingToken = localStorage.getItem("findnest_token");
      if (existingToken) {
        try {
          await api.post("/auth/logout");
        } catch (err) {
          console.error("Forced logout on login page failed:", err);
        }
        localStorage.removeItem("findnest_token");
        localStorage.removeItem("findnest_user");
      }
    };

    setStudentId("");
    setPassword("");
    forceLogoutIfSessionExists();
    const clearTimer = setTimeout(() => {
      setStudentId("");
      setPassword("");
    }, 150);

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setStudentId("");
        setPassword("");
        setStep("login");
        setMaskedEmail("");
        setOtp(["", "", "", "", "", ""]);
        setOtpError("");
        setError("");
        forceLogoutIfSessionExists();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      clearTimeout(clearTimer);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/student/login", {
        school_id: studentId,
        password: password,
      });
      setMaskedEmail(response.data.email);
      setStep("otp");
      startResendTimer();
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
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
      const response = await api.post("/auth/student/verify-otp", {
        school_id: studentId,
        otp: otpCode,
      });
      setAuth(response.data.token, response.data.user);
      window.location.href = "/student-home";
    } catch (err: any) {
      setOtpError(err.response?.data?.message || "Invalid OTP code");
      setOtp(["", "", "", "", "", ""]);
      document.getElementById("otp-0")?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    try {
      await api.post("/auth/student/resend-otp", { school_id: studentId });
      startResendTimer();
      setOtp(["", "", "", "", "", ""]);
      setOtpError("");
    } catch (err: any) {
      if (err.response?.status === 429) {
        const retryAfter = err.response?.data?.retry_after || 60;
        setResendTimer(Math.ceil(retryAfter));
        const interval = setInterval(() => {
          setResendTimer((prev) => {
            if (prev <= 1) { clearInterval(interval); return 0; }
            return prev - 1;
          });
        }, 1000);
        setOtpError("Please wait before requesting another code.");
      } else {
        setOtpError("Failed to resend OTP. Please try again.");
      }
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#1565c0] flex items-center justify-center relative overflow-hidden">

      <div className="absolute top-20 right-20 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-10">

        <div className="absolute top-0 left-0 right-0 h-2 bg-red-500 rounded-t-3xl" />

        {step === "login" ? (
          <>
            <div className="flex flex-col items-center mb-8">
              <h1 className="text-2xl font-black text-red-500">Student Login</h1>
              <p className="text-gray-400 text-sm mt-1">Use your school credentials</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5" autoComplete="off">

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">
                  Student ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. 2022-10043"
                    autoComplete="off"
                    name="fnd-user-field"
                    className="w-full pl-5 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition text-gray-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="new-password"
                    name="fnd-pass-field"
                    className="w-full pl-5 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition text-gray-700"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm text-center">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-xl transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform text-lg mt-2 disabled:opacity-50"
              >
                {loading ? "Sending OTP..." : "Sign In"}
              </button>

              <div className="text-center">
                <a href="/forgot-password" className="text-gray-400 hover:text-red-500 text-sm transition font-medium">
                  Forgot Password?
                </a>
              </div>

              <div className="text-center mt-4">
                <a
                  href="/"
                  className="text-gray-400 hover:text-red-500 text-sm transition font-medium"
                >
                  ← Back to Home
                </a>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center mb-8">
              <h1 className="text-2xl font-black text-red-500">Check Your Email</h1>
              <p className="text-gray-400 text-sm mt-1 text-center">
                We sent a 6-digit code to
              </p>
              <p className="text-red-500 font-bold text-sm mt-1">{maskedEmail}</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-3 text-center">Enter OTP Code</label>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-12 h-14 text-center text-xl font-black border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition text-gray-700"
                    />
                  ))}
                </div>
              </div>

              {otpError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm text-center">
                  {otpError}
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={otpLoading}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-xl transition shadow-lg disabled:opacity-50"
              >
                {otpLoading ? "Verifying..." : "Verify OTP"}
              </button>

              <div className="text-center">
                <button
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0}
                  className="text-sm font-bold text-red-500 disabled:text-gray-400 hover:underline transition"
                >
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Code"}
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={() => { setStep("login"); setOtp(["", "", "", "", "", ""]); setOtpError(""); }}
                  className="text-gray-400 hover:text-red-500 text-sm transition font-medium"
                >
                  ← Back to Login
                </button>
              </div>
            </div>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Use your official school-issued credentials to sign in.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            SJDM Cornerstone College Inc. © 2026
          </p>
        </div>
      </div>
    </main>
  );
}