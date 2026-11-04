"use client";
import { useEffect, useState } from "react";

// True only while the override is on and its 24 hours have not passed
export function isOverrideActive(u: { manual_override_granted?: boolean; override_expires_at?: string | null }) {
  return !!u.manual_override_granted && !!u.override_expires_at && new Date(u.override_expires_at).getTime() > Date.now();
}

// "Manual Override Active (Expires in 5h 12m)", counting down
export function OverridePill({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);

  return (
    <span className="inline-block mt-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      Manual Override Active (Expires in {h}h {String(m).padStart(2, "0")}m)
    </span>
  );
}

// Asks the admin for their own password before an override is granted
export function OverridePasswordModal({
  title,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  busy: boolean;
  error: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}) {
  const [pw, setPw] = useState("");
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4" onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-black text-[#1a237e] mb-1">{title}</h2>
        <p className="text-gray-400 text-sm mb-4">
          Enter your password to continue. The override turns off by itself after 24 hours.
        </p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && pw && !busy) onConfirm(pw); }}
          placeholder="Your password"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-sm text-gray-800"
        />
        {error && (
          <div role="alert" className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-semibold">{error}</div>
        )}
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={onCancel} className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">Cancel</button>
          <button
            type="button"
            disabled={!pw || busy}
            onClick={() => onConfirm(pw)}
            className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-2.5 rounded-xl transition text-sm disabled:opacity-50"
          >
            {busy ? "Checking..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}