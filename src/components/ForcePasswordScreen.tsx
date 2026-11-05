"use client";
import { useState } from "react";
import api from "@/lib/api";

const RULES = [
  { label: "At least 8 characters", ok: (p: string) => p.length >= 8 },
  { label: "An uppercase letter", ok: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", ok: (p: string) => /[a-z]/.test(p) },
  { label: "A number", ok: (p: string) => /[0-9]/.test(p) },
  { label: "A symbol", ok: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function ForcePasswordScreen({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const allOk = RULES.every((r) => r.ok(pw));

  async function submit() {
    if (!allOk) return setError("Your password does not meet all the rules below.");
    if (pw !== confirm) return setError("The two passwords do not match.");
    setError("");
    setBusy(true);
    try {
      await api.post("/profile/set-new-password", { new_password: pw, new_password_confirmation: confirm });
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
              <input
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#4ADE80] focus:outline-none text-sm text-gray-800"
              />
              <ul className="mt-2 mb-4 space-y-1">
                {RULES.map((r) => (
                  <li key={r.label} className={`text-xs font-semibold ${r.ok(pw) ? "text-green-600" : "text-gray-400"}`}>
                    {r.ok(pw) ? "✓" : "○"} {r.label}
                  </li>
                ))}
              </ul>

              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Confirm New Password</label>
              <input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !busy) submit(); }}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#4ADE80] focus:outline-none text-sm text-gray-800"
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="text-xs font-bold text-[#0D5C3A] mt-2 hover:underline">
                {show ? "Hide passwords" : "Show passwords"}
              </button>

              {error && (
                <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-semibold">{error}</div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="w-full mt-5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
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