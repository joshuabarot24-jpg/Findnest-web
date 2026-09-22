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
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
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
    <main className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#1565c0] flex items-center justify-center relative overflow-hidden">

      <div className="absolute top-20 right-20 w-96 h-96 bg-[#ffd700]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-20 w-64 h-64 bg-red-500/10 rounded-full blur-3xl"></div>

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-10">
        <div className="absolute top-0 left-0 right-0 h-2 bg-[#1a237e] rounded-t-3xl"></div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-2xl overflow-hidden mb-4 shadow-lg border-4 border-[#1a237e]">
            <Image src="/images/findnest-logo.svg" alt="FindNest Logo" width={96} height={96} />
          </div>
          <h1 className="text-2xl font-black text-[#1a237e]">Reset Password</h1>
          <p className="text-gray-400 text-sm mt-1 text-center">Enter your new password below</p>
        </div>

        {!token || !email ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-black text-gray-700 text-lg">Invalid Reset Link</p>
            <p className="text-gray-400 text-sm mt-2">This link is missing required information. Please request a new one.</p>
            <a href="/forgot-password" className="inline-block mt-6 text-[#1a237e] font-bold text-sm hover:underline">
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
            <p className="text-gray-400 text-sm mt-2">Your password has been changed. You can now log in with your new password.</p>
            <a href="/" className="inline-block mt-6 bg-[#1a237e] hover:bg-[#283593] text-white font-bold px-8 py-3 rounded-xl transition">
              Go to Login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full pl-5 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full pl-5 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#1a237e] to-[#1565c0] hover:from-[#283593] hover:to-[#1976d2] text-white font-black py-4 rounded-xl transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform text-lg mt-2 disabled:opacity-50"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a237e]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}