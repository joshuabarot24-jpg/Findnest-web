"use client";
import { useState, useEffect } from "react";
import api, { logoutUser } from "@/lib/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  school_id: string | null;
  course: string | null;
  year_level: string | null;
  trust_score: number;
  is_active: boolean;
  password_change_requested: boolean;
  password_change_approved: boolean;
  password_change_reason: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [reason, setReason] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [setPasswordError, setSetPasswordError] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/profile");
      setUser(res.data.user);
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleRequestPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setRequestError("Please tell us why you need a password change.");
      return;
    }
    setRequestError("");
    setRequestSuccess("");
    setRequestLoading(true);
    try {
      await api.post("/profile/request-password-change", { reason: reason.trim() });
      setRequestSuccess("Your request has been sent to the Super Admin.");
      setToast("Password change request sent.");
      setReason("");
      fetchProfile();
    } catch (err: any) {
      setRequestError(err.response?.data?.message || "Failed to send request.");
    } finally {
      setRequestLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setSetPasswordError("Please fill in both fields.");
      return;
    }
    if (newPassword.length < 8) {
      setSetPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setSetPasswordError("Passwords do not match.");
      return;
    }
    setSetPasswordError("");
    setSetPasswordLoading(true);
    try {
      await api.post("/profile/set-new-password", {
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      setToast("Password changed successfully.");
      setNewPassword("");
      setConfirmPassword("");
      fetchProfile();
    } catch (err: any) {
      setSetPasswordError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Failed to change password."
      );
    } finally {
      setSetPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
  };

  function trustScoreColor(score: number) {
    if (score >= 70) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-500";
  }

  function trustScoreBg(score: number) {
    if (score >= 70) return "bg-green-50 border-green-100";
    if (score >= 40) return "bg-yellow-50 border-yellow-100";
    return "bg-red-50 border-red-100";
  }

  function trustScoreLabel(score: number) {
    if (score >= 70) return "Good Standing";
    if (score >= 40) return "Moderate";
    return "Restricted";
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#1a237e] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <a href="/student-home" className="flex items-center gap-3">
          <span className="text-lg font-black text-[#1a237e]">FIND<span className="text-[#ffd700]">NEST</span></span>
        </a>
        <div className="flex items-center gap-8">
          <a href="/student-home" className="text-gray-500 hover:text-[#1a237e] transition text-sm font-medium">Home</a>
          <a href="/claim-status" className="text-gray-500 hover:text-[#1a237e] transition text-sm font-medium">Claim Status</a>
          <a href="/support" className="text-gray-500 hover:text-[#1a237e] transition text-sm font-medium">Support</a>
        </div>
        <div className="flex items-center gap-4">
          <a href="/notifications" className="relative w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-xl flex items-center justify-center transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </a>
          <a href="/profile" className="w-10 h-10 bg-[#1a237e] rounded-full flex items-center justify-center text-white font-bold text-sm">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </a>
        </div>
      </nav>

      <main className="px-8 py-10 max-w-3xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading profile...</div>
        ) : (
          <>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg flex-shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-black text-[#1a237e]">{user?.name}</h1>
                  <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="bg-blue-50 text-[#1a237e] text-xs font-bold px-3 py-1 rounded-full capitalize">{user?.role}</span>
                    {user?.course && <span className="text-gray-400 text-xs">{user.course} &middot; {user.year_level}</span>}
                    {user?.school_id && <span className="text-gray-400 text-xs">ID: {user.school_id}</span>}
                  </div>
                </div>
                <div className={`border rounded-2xl px-5 py-4 text-center ${trustScoreBg(user?.trust_score ?? 100)}`}>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Trust Score</p>
                  <p className={`text-3xl font-black ${trustScoreColor(user?.trust_score ?? 100)}`}>{user?.trust_score ?? 100}</p>
                  <p className={`text-xs font-bold mt-1 ${trustScoreColor(user?.trust_score ?? 100)}`}>{trustScoreLabel(user?.trust_score ?? 100)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4">
              <div className="px-8 pt-6">
                <h2 className="text-lg font-black text-[#1a237e]">Personal Information</h2>
                <p className="text-gray-400 text-sm mt-1">Managed by the school — contact the Guidance Office to request changes</p>
              </div>

              <div className="p-8 space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium text-sm">Full Name</span>
                  <span className="font-bold text-gray-700 text-sm">{user?.name}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium text-sm">Email Address</span>
                  <span className="font-bold text-gray-700 text-sm">{user?.email}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium text-sm">School ID</span>
                  <span className="font-bold text-gray-700 text-sm">{user?.school_id || "—"}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium text-sm">Course</span>
                  <span className="font-bold text-gray-700 text-sm">{user?.course || "—"}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium text-sm">Year Level</span>
                  <span className="font-bold text-gray-700 text-sm">{user?.year_level || "—"}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4">
              <div className="px-8 pt-6">
                <h2 className="text-lg font-black text-[#1a237e]">Password</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {user?.password_change_approved
                    ? "Your request was approved — set your new password below"
                    : "You can request a password change, which the Super Admin will review"}
                </p>
              </div>

              <div className="p-8">
                {user?.password_change_approved ? (
                  <form onSubmit={handleSetNewPassword} className="space-y-4">
                    <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-2">
                      <p className="text-green-700 text-xs font-semibold">
                        Your Super Admin approved your request. Set a new password only you will know.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700"
                      />
                    </div>
                    {setPasswordError && <p className="text-red-500 text-xs font-semibold">{setPasswordError}</p>}
                    <button
                      type="submit"
                      disabled={setPasswordLoading}
                      className="w-full bg-[#1a237e] hover:bg-[#283593] text-white font-black py-4 rounded-xl transition shadow-lg disabled:opacity-50"
                    >
                      {setPasswordLoading ? "Saving..." : "Set New Password"}
                    </button>
                  </form>
                ) : user?.password_change_requested ? (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-5 text-center">
                    <p className="text-yellow-700 font-bold text-sm">Request Pending</p>
                    <p className="text-yellow-600 text-xs mt-1">
                      Your password change request is awaiting Super Admin approval.
                      {user.password_change_reason && (
                        <span className="block mt-2 italic">"{user.password_change_reason}"</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleRequestPasswordChange} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        Why do you need a password change?
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. I forgot my password, or I want to update it for security"
                        rows={3}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700 resize-none"
                      />
                    </div>
                    {requestError && <p className="text-red-500 text-xs font-semibold">{requestError}</p>}
                    {requestSuccess && <p className="text-green-600 text-xs font-semibold">{requestSuccess}</p>}
                    <button
                      type="submit"
                      disabled={requestLoading}
                      className="w-full bg-[#1a237e] hover:bg-[#283593] text-white font-black py-4 rounded-xl transition shadow-lg disabled:opacity-50"
                    >
                      {requestLoading ? "Sending..." : "Request Password Change"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={handleLogout}
                className="w-full bg-red-50 hover:bg-red-500 hover:text-white text-red-500 font-bold py-4 rounded-xl transition border-2 border-red-100 hover:border-red-500"
              >
                Logout
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}