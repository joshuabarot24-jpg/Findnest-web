"use client";
import { useEffect, useState } from "react";
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

function PasswordField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={50}
          className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:border-[#0E4D34] focus:outline-none transition text-gray-700"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0D5C3A] cursor-pointer transition"
        >
          <EyeIcon off={show} />
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordForm({ onDone }: { onDone: (message: string) => void }) {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!current) return setError("Enter your current password.");
    if (!RULES.every((r) => r.ok(pw))) return setError("Your new password does not meet all the rules.");
    if (pw !== confirm) return setError("The two new passwords do not match.");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit verification code sent to your email address.");
    setError("");
    setBusy(true);
    try {
      const res = await api.post("/profile/change-password", {
        current_password: current,
        new_password: pw,
        new_password_confirmation: confirm,
        otp_code: code,
      });
      setCurrent(""); setPw(""); setConfirm(""); setCode(""); setCodeSent(false); setCooldown(0);
      onDone(res.data?.message || "Password updated successfully.");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(" ") ||
          "Could not update the password. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <PasswordField label="Current Password" value={current} onChange={setCurrent} />
      <div>
        <PasswordField label="New Password" value={pw} onChange={setPw} placeholder="8+ chars, A-Z, a-z, 0-9, symbol" />
        <ul className="mt-2 space-y-1">
          {RULES.map((r) => (
            <li key={r.label} className={`text-xs font-semibold ${r.ok(pw) ? "text-green-600" : "text-gray-400"}`}>
              {r.ok(pw) ? "✓" : "○"} {r.label}
            </li>
          ))}
        </ul>
      </div>
      <PasswordField label="Confirm New Password" value={confirm} onChange={setConfirm} />

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Email Verification Code</label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#0E4D34] focus:outline-none text-lg text-gray-800 tracking-[0.5em] text-center font-bold"
          />
          <button
            type="button"
            onClick={sendCode}
            disabled={cooldown > 0}
            className="shrink-0 px-4 py-3 rounded-xl border-2 border-[#0E4D34] text-[#0E4D34] text-xs font-bold hover:bg-[#E8F5E9] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : codeSent ? "Resend Code" : "Send Code"}
          </button>
        </div>
        {codeSent && <p className="text-xs text-green-600 font-semibold mt-2">A 6-digit verification code has been sent to your registered email address.</p>}
      </div>

      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-semibold">{error}</div>}

      <button
        type="submit"
        disabled={busy}
        className="bg-[#0F4C3A] hover:bg-[#0C3D2E] text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50"
      >
        {busy ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}