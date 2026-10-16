"use client";
// [UX] One shared source for the notification bell count on every student page.
// Loads right away, then refreshes every 15 seconds and when the tab regains focus.
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

export function useUnreadCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      setCount(res.data.unread_count ?? res.data.count ?? 0);
    } catch {
      // ignore: a failed refresh keeps the last known count
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 10000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("findnest:notifs-changed", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("findnest:notifs-changed", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  return { count, refresh };
}