"use client";
// [UX] One shared source for the notification bell count on every student page.
// The last known count is kept in memory, so the bell never flashes empty when a page changes.
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

let cachedCount = 0;
let cachedAt = 0;

// Call on logout so another student never sees the previous account's count
export function resetUnreadCache() {
  cachedCount = 0;
  cachedAt = 0;
}

export function useUnreadCount() {
  const [count, setCount] = useState(cachedCount);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      const next = res.data.unread_count ?? res.data.count ?? 0;
      cachedCount = next;
      cachedAt = Date.now();
      setCount(next);
    } catch {
      // ignore: a failed refresh keeps the last known count
    }
  }, []);

  useEffect(() => {
    // Show the cached count at once; only fetch on mount if it is older than 5 seconds
    if (Date.now() - cachedAt > 5000) refresh();
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