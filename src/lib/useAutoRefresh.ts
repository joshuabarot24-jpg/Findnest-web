"use client";
import { useEffect, useRef } from "react";

export const REFRESH_INTERVAL_MS = 20000;

export function useAutoRefresh(callback: () => void | Promise<void>, intervalMs = REFRESH_INTERVAL_MS) {
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    let running = false;

    const run = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        await latest.current();
      } finally {
        running = false;
      }
    };

    const id = setInterval(run, intervalMs);
    const onVisible = () => {
      if (!document.hidden) run();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", run);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", run);
    };
  }, [intervalMs]);
}