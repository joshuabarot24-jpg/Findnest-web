"use client";
// Student > Profile (/profile). Header card, details grid, password section.
// API: /profile, /profile/photo, /upload/image, /profile/request-password-change, /profile/set-new-password
import { useState, useEffect } from "react";
import api, { logoutUser } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import StudentLayout from "@/components/StudentLayout";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  school_id: string | null;
  course: string | null;
  year_level: string | null;
  education_level?: string | null;
  trust_score: number;
  is_active: boolean;
  password_change_requested: boolean;
  password_change_approved: boolean;
  password_change_reason: string | null;
  password_is_temporary?: boolean;
  profile_photo_url?: string | null;
  created_at: string;
}

const EDUCATION_LABELS: Record<string, string> = {
  college: "College",
  senior_high_school: "Senior High School",
  junior_high_school: "Junior High School",
  high_school: "High School",
};

function courseLabel(level?: string | null) {
  if (level === "senior_high_school") return "Strand";
  if (level === "junior_high_school") return "Section";
  return "Course";
}

export default function ProfilePage() {
  return (
    <AuthGate allowedRole="student">
      <ProfileContent />
    </AuthGate>
  );
}

function ProfileContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [reason, setReason] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoDrag, setPhotoDrag] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [setPasswordError, setSetPasswordError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

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
  useAutoRefresh(fetchProfile);

  // Uploads to Cloudinary (moderated, no item analysis), then saves the URL on the account
  const uploadPhoto = async (file: File | undefined) => {
    if (!file || photoBusy) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file (JPG, PNG, WEBP).");
      return;
    }
    setPhotoError("");
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("folder", "profiles");
      fd.append("analyze", "false");
      const up = await api.post("/upload/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await api.post("/profile/photo", { photo_url: up.data.url });
      await fetchProfile();
    } catch (err: any) {
      setPhotoError(err.response?.data?.message || "Could not upload the photo. Please try again.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeProfilePhoto = async () => {
    setPhotoBusy(true);
    try {
      await api.delete("/profile/photo");
      await fetchProfile();
    } catch {
      setPhotoError("Could not remove the photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

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
    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      setSetPasswordError("Password must be 8+ characters with an uppercase letter, a lowercase letter, a number and a special character.");
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

  const handleSaveEmail = async () => {
    setEmailError("");
    setEmailSaving(true);
    try {
      await api.put("/profile", { email: emailInput.trim() });
      setToast("Email updated successfully.");
      setEditingEmail(false);
      fetchProfile();
    } catch (err: any) {
      setEmailError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Failed to update email."
      );
    } finally {
      setEmailSaving(false);
    }
  };

  function trustScoreColor(score: number) {
    if (score >= 70) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-500";
  }

  function trustScoreLabel(score: number) {
    if (score >= 70) return "Good Standing";
    if (score >= 40) return "Moderate";
    return "Restricted";
  }

    const score = user?.trust_score ?? 100;

  // One labeled row in the details grid
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="p-3 bg-[#F3FAF6] rounded-xl">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="font-bold text-gray-800 text-sm mt-1 break-words">{children}</div>
    </div>
  );

  return (
    <StudentLayout active="/profile">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#0E4D34] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="w-full">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading profile...</div>
        ) : (
          <div className="space-y-5">
            {/* Header card */}
            <div className="bg-white rounded-2xl border border-[#D9E8DF] shadow-sm p-6">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <label
                    onDragOver={(e) => { e.preventDefault(); setPhotoDrag(true); }}
                    onDragLeave={() => setPhotoDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setPhotoDrag(false); uploadPhoto(e.dataTransfer.files?.[0]); }}
                    className={`relative w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-white font-black text-4xl shadow-lg cursor-pointer bg-[#0E4D34] ring-4 ${photoDrag ? "ring-[#2FD18B]" : "ring-white"}`}
                    title="Change photo"
                  >
                    {user?.profile_photo_url ? (
                      <img src={user.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      user?.name?.charAt(0).toUpperCase() || "?"
                    )}
                    {photoBusy && (
                      <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="w-6 h-6 border-4 border-white/40 border-t-white rounded-full animate-spin" />
                      </span>
                    )}
                    <input type="file" accept="image/*" className="hidden" disabled={photoBusy} onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="text-[#0E4D34]">Change photo</span>
                    {user?.profile_photo_url && (
                      <button type="button" onClick={removeProfilePhoto} disabled={photoBusy} className="text-red-500 hover:underline">Remove</button>
                    )}
                  </div>
                  {photoError && <p className="text-red-500 text-[11px] font-semibold max-w-[10rem] text-center">{photoError}</p>}
                </div>

                <div className="flex-1 min-w-[12rem]">
                  <h1 className="font-bold text-xl text-slate-900">{user?.name}</h1>
                  <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="bg-[#E3EEE7] text-[#0E4D34] text-xs font-bold px-3 py-1 rounded-full capitalize">{user?.role}</span>
                    {user?.school_id && <span className="text-gray-500 text-xs">ID: {user.school_id}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Details card with watermark */}
            <div className="relative overflow-hidden bg-white rounded-2xl border border-[#D9E8DF] shadow-sm">
              <img
                src="/images/findnest-logo.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 object-contain opacity-10"
              />

              <div className="relative z-10 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-lg font-black text-[#0E4D34]">Profile Details</h2>
                    <p className="text-gray-500 text-sm mt-1">Managed by the school. Contact the Guidance Office to request changes.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <p className="text-xs font-black text-[#0E4D34] uppercase tracking-wider">Personal Information</p>
                    <Field label="Full Name">{user?.name}</Field>
                    <div className="p-3 bg-[#F3FAF6] rounded-xl">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Email Address</p>
                        {!editingEmail && (
                          <button
                            onClick={() => { setEmailInput(user?.email || ""); setEmailError(""); setEditingEmail(true); }}
                            className="text-[#0E4D34] text-xs font-bold hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {!editingEmail ? (
                        <p className="font-bold text-gray-800 text-sm mt-1 break-words">{user?.email}</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <input
                            type="email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-[#0E4D34] focus:outline-none transition text-gray-700 text-sm bg-white"
                          />
                          {emailError && <p className="text-red-500 text-xs font-semibold">{emailError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingEmail(false)}
                              className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-2 rounded-xl hover:bg-gray-100 transition text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEmail}
                              disabled={emailSaving}
                              className="flex-1 bg-[#0E4D34] hover:bg-[#0A3021] text-white font-bold py-2 rounded-xl transition text-xs disabled:opacity-50"
                            >
                              {emailSaving ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-black text-[#0E4D34] uppercase tracking-wider">Academic Information</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Education Level">{(user?.education_level && EDUCATION_LABELS[user.education_level]) || "—"}</Field>
                      <Field label="School ID">{user?.school_id || "—"}</Field>
                      <Field label={courseLabel(user?.education_level)}>{user?.course || "—"}</Field>
                      <Field label="Year Level">{user?.year_level || "—"}</Field>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-black text-[#0E4D34] uppercase tracking-wider mb-3">System Stats</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Trust Score">
                      <span className={`text-xl font-black ${trustScoreColor(score)}`}>{score}</span>
                      <span className={`ml-2 text-xs font-bold ${trustScoreColor(score)}`}>{trustScoreLabel(score)}</span>
                    </Field>
                    <Field label="Account Status">
                      <span
                        className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                          user?.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {user?.is_active ? "ACTIVE" : "ARCHIVED"}
                      </span>
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            {/* Password card */}
            <div className="bg-white rounded-2xl border border-[#D9E8DF] shadow-sm overflow-hidden">
              <div className="px-6 pt-6">
                <h2 className="text-lg font-black text-[#0E4D34]">Change Password</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {user?.password_is_temporary
                    ? "You are using a temporary password. Set your own now."
                    : user?.password_change_approved
                    ? "Your request was approved. Set your new password below."
                    : "You can request a password change, which the Super Admin will review."}
                </p>
              </div>

              <div className="p-6">
                {user?.password_is_temporary || user?.password_change_approved ? (
                  <form onSubmit={handleSetNewPassword} className="space-y-4 max-w-xl">
                    <div className="bg-[#E3EEE7] border border-[#B9CBBF] rounded-2xl p-4">
                      <p className="text-[#1E3F2E] text-xs font-semibold">
                        {user?.password_is_temporary
                          ? "Your account was created with a temporary password. Set one only you will know. After this, further changes need Super Admin approval."
                          : "Your Super Admin approved your request. Set a new password only you will know."}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="8+ chars, A-Z, a-z, 0-9, symbol"
                          maxLength={50}
                          className="w-full pl-4 pr-16 py-3 border-2 border-gray-200 rounded-xl focus:border-[#0E4D34] focus:outline-none transition text-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0E4D34] hover:underline"
                        >
                          {showNewPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          maxLength={50}
                          className="w-full pl-4 pr-16 py-3 border-2 border-gray-200 rounded-xl focus:border-[#0E4D34] focus:outline-none transition text-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0E4D34] hover:underline"
                        >
                          {showConfirmPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    {setPasswordError && <p className="text-red-500 text-xs font-semibold">{setPasswordError}</p>}
                    <button
                      type="submit"
                      disabled={setPasswordLoading}
                      className="w-full bg-[#0E4D34] hover:bg-[#0A3021] text-white font-black py-3.5 rounded-xl transition shadow-lg disabled:opacity-50"
                    >
                      {setPasswordLoading ? "Saving..." : "Set New Password"}
                    </button>
                  </form>
                ) : user?.password_change_requested ? (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-5 text-center max-w-xl">
                    <p className="text-yellow-700 font-bold text-sm">Request Pending</p>
                    <p className="text-yellow-600 text-xs mt-1">
                      Your password change request is awaiting Super Admin approval.
                      {user.password_change_reason && (
                        <span className="block mt-2 italic">&quot;{user.password_change_reason}&quot;</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleRequestPasswordChange} className="space-y-4 max-w-xl">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        Why do you need a password change?
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. I forgot my password, or I want to update it for security"
                        rows={3}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#0E4D34] focus:outline-none transition text-gray-700 resize-none"
                      />
                    </div>
                    {requestError && <p className="text-red-500 text-xs font-semibold">{requestError}</p>}
                    {requestSuccess && <p className="text-green-600 text-xs font-semibold">{requestSuccess}</p>}
                    <button
                      type="submit"
                      disabled={requestLoading}
                      className="w-full bg-[#0E4D34] hover:bg-[#0A3021] text-white font-black py-3.5 rounded-xl transition shadow-lg disabled:opacity-50"
                    >
                      {requestLoading ? "Sending..." : "Request Password Change"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <button
              onClick={() => logoutUser()}
              className="w-full bg-red-50 hover:bg-red-500 hover:text-white text-red-500 font-bold py-3.5 rounded-xl transition border-2 border-red-100 hover:border-red-500"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}