"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

    setUsername("");
    setPassword("");
    forceLogoutIfSessionExists();
    const clearTimer = setTimeout(() => {
      setUsername("");
      setPassword("");
    }, 150);

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setUsername("");
        setPassword("");
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
        const response = await api.post("/auth/admin/login", {
          email: username,
          password: password,
        });
        setAuth(response.data.token, response.data.user);
        window.location.href = "/dashboard";
      } catch (err: any) {
        setError(err.response?.data?.message || "Invalid credentials");
      } finally {
        setLoading(false);
      }
    };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#1565c0] flex items-center justify-center relative overflow-hidden">

      <div className="absolute top-20 right-20 w-96 h-96 bg-[#ffd700]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-20 w-64 h-64 bg-red-500/10 rounded-full blur-3xl"></div>

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-10">

        <div className="absolute top-0 left-0 right-0 h-2 bg-[#ffd700] rounded-t-3xl"></div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-2xl overflow-hidden mb-4 shadow-lg border-4 border-[#ffd700]">
            <Image
              src="/images/findnest-logo.svg"
              alt="FindNest Logo"
              width={96}
              height={96}
            />
          </div>
          <h1 className="text-2xl font-black text-[#ffd700]">Admin Login</h1>
          <p className="text-gray-400 text-sm mt-1 text-center">Secure Access for School Personnel</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5" autoComplete="off">

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">
              Employee Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="off"
                name="fnd-user-field"
                className="w-full pl-5 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#ffd700] focus:outline-none transition text-gray-700"
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
                className="w-full pl-5 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#ffd700] focus:outline-none transition text-gray-700"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1a237e] transition"
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
            className="w-full bg-gradient-to-r from-[#1a237e] to-[#1565c0] hover:from-[#283593] hover:to-[#1976d2] text-white font-black py-4 rounded-xl transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform text-lg mt-2 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login to Dashboard"}
          </button>

          <div className="text-center">
            <a href="/forgot-password" className="text-gray-400 hover:text-[#1a237e] text-sm transition font-medium">
              Forgot Password?
            </a>
          </div>

          <div className="text-center mt-4">
            <a
              href="/"
              className="text-gray-400 hover:text-[#1a237e] text-sm transition font-medium"
            >
              ← Back to Home
            </a>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            This portal is restricted to authorized school personnel only.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            SJDM Cornerstone College Inc. © 2026
          </p>
        </div>
      </div>
    </main>
  );
}