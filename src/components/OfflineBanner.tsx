"use client";
import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [showBack, setShowBack] = useState(false);

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
      setShowBack(true);
      timer = setTimeout(() => setShowBack(false), 3000);
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if (timer) clearTimeout(timer);
    };
  }, []);

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