"use client";
import { useEffect } from "react";

export default function AuthGuard() {
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        const token = localStorage.getItem("findnest_token");
        const isLandingPage = window.location.pathname === "/";
        if (!token && !isLandingPage) {
          window.location.href = "/";
        }
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}