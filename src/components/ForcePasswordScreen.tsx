"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";

const RULES = [
  { label: "At least 8 characters", ok: (p: string) => p.length >= 8 },
  { label: "An uppercase letter", ok: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", ok: (p: string) => /[a-z]/.test(p) },
  { label: "A number", ok: (p: string) => /[0-9]/.test(p) },
  { label: "A symbol", ok: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (
        <>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </>
      ) : (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default function ForcePasswordScreen({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    if (cooldown > 0) return;
    setError("");
    try {
      await api.post("/profile/send-password-otp");
      setCodeSent(true);
      setCooldown(60);
    } catch (err: any) {
      if (err.response?.status === 429) setCooldown(Math.ceil(err.response.data?.retry_after || 60));
      setError(err.response?.data?.message || "Could not send the code. Please try again.");
    }
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const allOk = RULES.every((r) => r.ok(pw));

  async function submit() {
    if (!allOk) return setError("Your password does not meet all the rules below.");
    if (pw !== confirm) return setError("The two passwords do not match.");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit verification code sent to your email.");
    setError("");
    setBusy(true);
    try {
      await api.post("/profile/set-new-password", { new_password: pw, new_password_confirmation: confirm, otp_code: code });
      setSuccess(true);
      setTimeout(onDone, 1800);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(" ") ||
          "Could not change the password. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[500] bg-[#F2F8F5] flex items-center justify-center px-4 overflow-y-auto py-8">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E2EFE9] w-full max-w-md overflow-hidden">
        <div className="bg-[#0D5C3A] px-6 py-4">
          <p className="text-white font-black text-sm tracking-wide">Action Required: Temporary Password Detected</p>
        </div>
        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <p className="font-black text-[#0D5C3A] text-lg">Password updated successfully!</p>
              <p className="text-gray-500 text-sm mt-1">Welcome to FindNest.</p>
            </div>
          ) : (
            <>
              <p className="text-gray-500 text-sm mb-5">
                You are logged in with a temporary password (new account or recent reset). For your security, create a new permanent password before using the system.
              </p>

              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#4ADE80] focus:outline-none text-sm text-gray-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0D5C3A] cursor-pointer transition"
                >
                  <EyeIcon off={showPw} />
                </button>
              </div>
              <ul className="mt-2 mb-4 space-y-1">
                {RULES.map((r) => (
                  <li key={r.label} className={`text-xs font-semibold ${r.ok(pw) ? "text-green-600" : "text-gray-400"}`}>
                    {r.ok(pw) ? "✓" : "○"} {r.label}
                  </li>
                ))}
              </ul>

              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !busy) submit(); }}
                  className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#4ADE80] focus:outline-none text-sm text-gray-800"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0D5C3A] cursor-pointer transition"
                >
                  <EyeIcon off={showConfirm} />
                </button>
              </div>

              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mt-5 mb-1">Email Verification Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="flex-1 min-w-0 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#4ADE80] focus:outline-none text-lg text-gray-800 tracking-[0.5em] text-center font-bold"
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={cooldown > 0}
                  className="shrink-0 px-3 py-2.5 rounded-xl border-2 border-[#0F4C3A] text-[#0F4C3A] text-xs font-bold hover:bg-[#0F4C3A]/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cooldown > 0 ? `Send again in ${cooldown}s` : codeSent ? "Resend Code" : "Send Verification Code"}
                </button>
              </div>
              {codeSent && <p className="text-xs text-green-600 font-semibold mt-2">A 6-digit verification code has been sent to your registered email address.</p>}

              {error && (
                <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-semibold">{error}</div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="w-full mt-5 bg-[#0F4C3A] hover:bg-[#0C3D2E] active:bg-[#0A3326] text-white font-bold py-3.5 rounded-xl transition-all duration-200 shadow-sm antialiased disabled:opacity-50"
              >
                {busy ? "Saving..." : "Set New Password"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}