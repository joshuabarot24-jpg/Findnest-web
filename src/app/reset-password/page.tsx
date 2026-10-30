"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import api from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordCheck, setShowPasswordCheck] = useState(false);
  const [passwordLocked, setPasswordLocked] = useState(false);

  useEffect(() => {
    setToken(searchParams.get("token") || "");
    setEmail(searchParams.get("email") || "");
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError("Password must be 8+ characters with an uppercase letter, a lowercase letter, a number and a special character.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email,
        token,
        password,
        password_confirmation: confirmPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Failed to reset password. The link may be invalid or expired."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-[#F2F8F5] to-white font-sans">
      {/* Top navigation, like the landing page */}
      <header className="w-full flex items-center justify-between px-4 sm:px-8 xl:px-12 py-4">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <Image src="/images/findnest-logo.png" alt="FindNest logo" width={36} height={36} className="rounded-lg" />
          <span className="text-xl font-black tracking-wide text-[#0D5C3A]">
            FIND<span className="text-[#EAB308]">NEST</span>
          </span>
        </a>
        <nav className="flex items-center gap-3 sm:gap-8">
          <a href="/" className="hidden md:inline text-[#0D5C3A]/80 hover:text-[#0D5C3A] transition-all duration-300 font-semibold text-sm tracking-wide">HOME</a>
          <a href="/#about" className="hidden md:inline text-[#0D5C3A]/80 hover:text-[#0D5C3A] transition-all duration-300 font-semibold text-sm tracking-wide">ABOUT</a>
          <a
            href="/"
            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold tracking-wide px-5 sm:px-7 py-2.5 rounded-full shadow-md text-sm transition-all duration-300"
          >
            LOG IN
          </a>
        </nav>
      </header>

      {/* Card */}
      <section className="relative flex items-center justify-center min-h-[calc(100vh-80px)] w-full px-4 py-8 overflow-hidden">
        {/* Soft shapes behind the card, so the frosted glass has something to blur */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/4 left-[12%] w-72 h-72 rounded-full bg-[#86EFAC]/40 blur-3xl"></div>
          <div className="absolute bottom-[12%] right-[10%] w-80 h-80 rounded-full bg-[#4ADE80]/25 blur-3xl"></div>
          <div className="absolute top-[12%] right-[28%] w-40 h-40 rounded-full bg-[#FACC15]/20 blur-3xl"></div>
        </div>

        <div className="relative bg-white/80 backdrop-blur-md rounded-3xl shadow-xl shadow-[#0D5C3A]/10 border border-white/70 w-full max-w-md p-8 sm:p-10">
          <div className="absolute top-0 left-0 right-0 h-2 bg-[#0D5C3A] rounded-t-3xl"></div>

          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-2xl overflow-hidden mb-4 shadow-lg border-4 border-[#0D5C3A]">
              <Image src="/images/findnest-logo.png" alt="FindNest Logo" width={96} height={96} />
            </div>
            <h1 className="text-2xl font-black text-[#0D5C3A]">Reset Password</h1>
            <p className="text-[#64748B] text-sm mt-1 text-center">Enter your new password below</p>
          </div>

          {!token || !email ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-black text-gray-700 text-lg">Invalid Reset Link</p>
              <p className="text-[#64748B] text-sm mt-2">This link is missing required information. Please request a new one.</p>
              <a href="/forgot-password" className="inline-block mt-6 text-[#0D5C3A] hover:text-[#16A34A] font-bold text-sm transition">
                Request New Link
              </a>
            </div>
          ) : success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-black text-gray-700 text-lg">Password Reset!</p>
              <p className="text-[#64748B] text-sm mt-2">Your password has been changed. You can now log in with your new password.</p>
              <a href="/" className="inline-block mt-6 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-8 py-3 rounded-xl transition shadow-md">
                Go to Login
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8+ chars, A-Z, a-z, 0-9, symbol"
                    className="w-full pl-5 pr-16 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4ADE80] focus:outline-none transition text-gray-700"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0D5C3A] transition text-xs font-bold"
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full pl-5 pr-16 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4ADE80] focus:outline-none transition text-gray-700"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0D5C3A] transition text-xs font-bold"
                  >
                    {showConfirmPassword ? "HIDE" : "SHOW"}
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
                className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-black py-4 rounded-xl transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform text-lg mt-2 disabled:opacity-50"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}
        </div>
      </section>

      {showPasswordCheck && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-md px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
            <h2 className="text-lg font-black text-[#0D5C3A] mb-2">Confirm Password</h2>
            <p className="text-[#64748B] text-sm mb-4">Please confirm this is the password you intended to set</p>
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="font-mono font-bold text-gray-700 text-lg break-all">{password}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPassword("");
                  setShowPasswordCheck(false);
                }}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Re-type
              </button>
              <button
                onClick={() => {
                  setPasswordLocked(true);
                  setShowPasswordCheck(false);
                }}
                className="flex-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold py-3 rounded-2xl transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F2F8F5]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}