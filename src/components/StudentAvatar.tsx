"use client";
// Shows the student's profile photo, or their initial when there is none.
// Reads the saved photo first (instant), then refreshes it from /profile.
import { useEffect, useState } from "react";
import api from "@/lib/api";

const KEY = "findnest_avatar";

export default function StudentAvatar({ name }: { name?: string | null }) {
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPhoto(sessionStorage.getItem(KEY) || null);
    } catch {}
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/profile");
        const url: string | null = res.data.user?.profile_photo_url ?? null;
        try {
          if (url) sessionStorage.setItem(KEY, url);
          else sessionStorage.removeItem(KEY);
        } catch {}
        if (!cancelled) setPhoto(url);
      } catch {
        // keep whatever is shown
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (photo) {
    return <img src={photo} alt="Profile" className="w-full h-full object-cover" />;
  }
  return <>{name?.trim().charAt(0).toUpperCase() || "?"}</>;
}