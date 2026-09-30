"use client";
import { useState, useLayoutEffect, ReactNode } from "react";

interface AuthGateProps {
  allowedRole: "super_admin" | "admin" | "student";
  children: ReactNode;
}

let verifiedRoleThisSession: string | null = null;

export default function AuthGate({ allowedRole, children }: AuthGateProps) {
  const [status, setStatus] = useState<"checking" | "ok">(
    verifiedRoleThisSession === allowedRole ? "ok" : "checking"
  );

  function checkAuth() {
    const token = localStorage.getItem("findnest_token");
    const userStr = localStorage.getItem("findnest_user");

    if (!token || !userStr) {
      verifiedRoleThisSession = null;
      window.location.href = "/";
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role !== allowedRole) {
        verifiedRoleThisSession = null;
        window.location.href = "/";
        return;
      }
      verifiedRoleThisSession = allowedRole;
      setStatus("ok");
    } catch {
      window.location.href = "/";
    }
  }

  useLayoutEffect(() => {
    checkAuth();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "findnest_token" || e.key === "findnest_user") {
        checkAuth();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        const remembered = localStorage.getItem("findnest_remember_me") === "true";
        if (!remembered) {
          verifiedRoleThisSession = null;
          localStorage.removeItem("findnest_token");
          localStorage.removeItem("findnest_user");
          window.location.href = "/";
        }
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a237e]/20 border-t-[#1a237e] rounded-full animate-spin" />
          <p className="text-gray-400 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}