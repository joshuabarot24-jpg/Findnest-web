"use client";
import { useState } from "react";
import Image from "next/image";
import api from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
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
          <h1 className="text-2xl font-black text-[#1a237e]">Forgot Password</h1>
          <p className="text-gray-400 text-sm mt-1 text-center">
            Enter your email and we will send you a reset link
          </p>
        </div>

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="font-black text-gray-700 text-lg">Check Your Email</p>
            <p className="text-gray-400 text-sm mt-2">
              If an account exists with that email, a password reset link has been sent. The link expires in 60 minutes.
            </p>
            <a
              href="/"
              className="inline-block mt-6 text-[#1a237e] font-bold text-sm hover:underline"
            >
              Back to Home
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
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
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <div className="text-center mt-4">
              <a href="/" className="text-gray-400 hover:text-[#1a237e] text-sm transition font-medium">
                ← Back to Home
              </a>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}