"use client";
// [UX] Styled logout confirmation. Mounted once in the root layout.
// Opens when any logout button fires the "findnest:confirm-logout" event.
import { useEffect, useRef, useState } from "react";
import { performLogout } from "@/lib/api";

export default function LogoutConfirmHost() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("findnest:confirm-logout", onOpen);
    return () => window.removeEventListener("findnest:confirm-logout", onOpen);
  }, []);

  // Focus Cancel when opened; Escape closes
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  if (!open) return null;

  return (
    <div
      onClick={() => { if (!busy) setOpen(false); }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center"
      >
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
        <h2 id="logout-title" className="text-xl font-black text-[#1a237e] mb-2">Log out?</h2>
        <p className="text-gray-400 text-sm mb-8">Are you sure you want to log out of FindNest?</p>

        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={() => setOpen(false)}
            disabled={busy}
            className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={async () => { setBusy(true); await performLogout(); }}
            disabled={busy}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
          >
            {busy ? "Logging out..." : "Log out"}
          </button>
        </div>
      </div>
    </div>
  );
}