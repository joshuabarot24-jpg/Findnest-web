"use client";
import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [showBack, setShowBack] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const goOffline = () => {
      if (timer) clearTimeout(timer);
      setShowBack(false);
      setOnline(false);
    };

    const goOnline = () => {
      setOnline(true);
      setBlocked(false);
      setTried(false);
      setShowBack(true);
      timer = setTimeout(() => setShowBack(false), 3000);
    };

    const onClick = (e: MouseEvent) => {
      if (navigator.onLine) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-offline-screen]")) return;
      e.preventDefault();
      e.stopPropagation();
      setBlocked(true);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      document.removeEventListener("click", onClick, true);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!online && blocked) {
    return (
      <div
        data-offline-screen
        className="fixed inset-0 z-[600] flex flex-col items-center justify-center bg-white px-6 text-center"
      >
        <svg
          width="72"
          height="72"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h.01" />
          <path d="M8.5 16.429a5 5 0 0 1 7 0" />
          <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
          <path d="M13.83 10.17A10 10 0 0 1 19 12.859" />
          <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
          <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
          <path d="m2 2 20 20" />
        </svg>
        <h1 className="mt-6 text-2xl font-black text-[#0E4D34]">No internet connection</h1>
        <p className="mt-2 text-sm text-gray-500 max-w-xs">
          Check your Wi-Fi or mobile data, then try again. FindNest will continue as soon as you are back online.
        </p>
        <button
          type="button"
          onClick={() => {
            if (navigator.onLine) {
              setOnline(true);
              setBlocked(false);
            } else {
              setTried(true);
            }
          }}
          className="mt-6 rounded-full bg-[#0E4D34] px-8 py-3 text-sm font-bold text-white hover:bg-[#0A3021] transition"
        >
          Try again
        </button>
        {tried && <p className="mt-3 text-xs font-semibold text-red-500">Still no connection.</p>}
      </div>
    );
  }

  if (online && !showBack) return null;

  return (
    <div
      role="alert"
      className={`fixed top-0 inset-x-0 z-[500] px-4 py-2 text-center text-sm font-bold text-white shadow-md ${
        online ? "bg-[#0E4D34]" : "bg-red-600"
      }`}
    >
      {online
        ? "Back online"
        : "No internet connection. Please check your connection and try again."}
    </div>
  );
}