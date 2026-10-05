"use client";
// Super Admin > User Management (/user-management). Manages student accounts.
// API: /users, /users/{id}/revoke, /toggle-restriction, /adjust-trust-score, /system/trust-settings
import { useState, useMemo, useEffect } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

interface SystemUser {
  id: number;
  name: string;
  email: string;
  role: string;
  school_id: string | null;
  course: string | null;
  year_level: string | null;
  education_level: string | null;
  is_active: boolean;
  is_restricted: boolean;
  trust_score: number;
  password_change_requested: boolean;
  password_change_approved: boolean;
  password_change_reason: string | null;
  password_last_changed_at: string | null;
  created_at?: string;
}

const PAGE_SIZE = 5;

const EDUCATION_LEVELS = [
  { value: "college", label: "College" },
  { value: "senior_high_school", label: "Senior High School" },
  { value: "junior_high_school", label: "Junior High School" },
];

const STRANDS = [
  { value: "STEM", label: "STEM (Science, Technology, Engineering, and Mathematics)" },
  { value: "ABM", label: "ABM (Accountancy, Business, and Management)" },
  { value: "HUMSS", label: "HUMSS (Humanities and Social Sciences)" },
  { value: "GAS", label: "GAS (General Academic Strand)" },
  { value: "TVL", label: "TVL (Technical-Vocational-Livelihood)" },
];

const JHS_GRADES = ["Grade 7", "Grade 8", "Grade 9", "Grade 10"];
const COLLEGE_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const NAME_REGEX = /^[A-Za-z\s.'-]*$/;
const DIGITS_REGEX = /^[0-9]*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.con": "gmail.com",
  "yahoo.co": "yahoo.com",
  "yahoo.cm": "yahoo.com",
  "outlook.co": "outlook.com",
};

// Flags common email domain typos (e.g. gmail.con)
function checkEmailDomainTypo(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && COMMON_DOMAIN_TYPOS[domain]) {
    return `Did you mean ${email.split("@")[0]}@${COMMON_DOMAIN_TYPOS[domain]}?`;
  }
  return null;
}

// Keeps only letters, spaces, dots, apostrophes and hyphens
function filterLettersOnly(value: string) {
  return value.replace(/[^A-Za-z\s.'-]/g, "");
}

// Keeps only digits
function filterDigitsOnly(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function educationLabel(value: string | null) {
  const found = EDUCATION_LEVELS.find((e) => e.value === value);
  return found ? found.label : value || "—";
}

export default function UserManagement() {
  return (
    <AuthGate allowedRole="super_admin">
      <UserManagementContent />
    </AuthGate>
  );
}

function UserManagementContent() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const [studentSubTab, setStudentSubTab] = useState<"all" | "college" | "senior_high_school" | "junior_high_school" | "revoked" | "password_requests" | "restricted">("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [approvingPassword, setApprovingPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [revokingUser, setRevokingUser] = useState<SystemUser | null>(null);
  const [restrictingUser, setRestrictingUser] = useState<SystemUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
    school_id: "",
    course: "",
    year_level: "",
    education_level: "college",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [confirmEditPassword, setConfirmEditPassword] = useState("");
  const [adjustingTrustScore, setAdjustingTrustScore] = useState<SystemUser | null>(null);
  const [trustScorePoints, setTrustScorePoints] = useState("");
  const [trustScoreReason, setTrustScoreReason] = useState("");
  const [trustScoreSubmitting, setTrustScoreSubmitting] = useState(false);
  const [trustScoreError, setTrustScoreError] = useState("");
  const [showCreatePasswordConfirm, setShowCreatePasswordConfirm] = useState(false);
  const [passwordFieldLocked, setPasswordFieldLocked] = useState(false);
  const [editPasswordLocked, setEditPasswordLocked] = useState(false);
  const [showEditPasswordCheck, setShowEditPasswordCheck] = useState(false);
  const [editPwVisible, setEditPwVisible] = useState(false);
  const [confirmCreatePassword, setConfirmCreatePassword] = useState("");
  const [showRestrictionSettings, setShowRestrictionSettings] = useState(false);
  const [restrictionDays, setRestrictionDays] = useState("7");
  const [restrictionThreshold, setRestrictionThreshold] = useState("50");
  const [restrictionSaving, setRestrictionSaving] = useState(false);
  const [restrictionError, setRestrictionError] = useState("");

  useEffect(() => {
    setEditPwVisible(false);
  }, [editingUser]);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Loads all users, keeps students only
  const fetchUsers = async () => {
    try {
      const response = await api.get("/users");
      const allUsers: SystemUser[] = response.data.users || [];
      setUsers(allUsers.filter((u) => u.role === "student"));
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);
  useAutoRefresh(fetchUsers);

  // Rows for the selected tab (before search/sort)
  const baseFiltered = useMemo(() => {
    if (studentSubTab === "all") return users.filter((u) => u.is_active);
    if (studentSubTab === "revoked") return users.filter((u) => !u.is_active);
    if (studentSubTab === "password_requests") return users.filter((u) => u.password_change_requested);
    if (studentSubTab === "restricted") return users.filter((u) => u.is_restricted && u.is_active);
    return users.filter((u) => u.education_level === studentSubTab && u.is_active);
  }, [users, studentSubTab]);

  const idNumberMap = useMemo(() => {
    const sorted = [...users].sort((a, b) => a.id - b.id);
    const map = new Map<number, number>();
    sorted.forEach((u, idx) => map.set(u.id, idx + 1));
    return map;
  }, [users]);

  function displayId(userId: number) {
    const num = idNumberMap.get(userId) ?? userId;
    return `USR-${String(num).padStart(2, "0")}`;
  }

  // Search + sort on top of the tab filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = baseFiltered;
    if (q) {
      result = baseFiltered.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.school_id || "").toLowerCase().includes(q) ||
          (u.course || "").toLowerCase().includes(q) ||
          (u.year_level || "").toLowerCase().includes(q) ||
          educationLabel(u.education_level).toLowerCase().includes(q) ||
          displayId(u.id).toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      const diff = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      return sortOrder === "oldest" ? diff : -diff;
    });
  }, [baseFiltered, search, idNumberMap, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [studentSubTab, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;
  const pendingPasswordCount = users.filter((u) => u.password_change_requested).length;

  function resetForm() {
    setConfirmCreatePassword("");
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "student",
      school_id: "",
      course: "",
      year_level: "",
      education_level: "college",
    });
    setFormError("");
  }

  function openCreateModal() {
    resetForm();
    setShowCreateModal(true);
  }

  function openEditModal(user: SystemUser) {
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      school_id: user.school_id || "",
      course: user.course || "",
      year_level: user.year_level || "",
      education_level: user.education_level || "college",
    });
    setFormError("");
    setConfirmEditPassword("");
    setEditPasswordLocked(false);
    setEditingUser(user);
  }

  // Returns an error message, or null when the form is valid
  function validateForm(): string | null {
    if (!formData.name.trim()) return "Full name is required.";
    if (!NAME_REGEX.test(formData.name)) return "Full name must contain letters only.";
    if (!EMAIL_REGEX.test(formData.email.trim())) return "Please enter a complete, valid email address.";
    const typoWarning = checkEmailDomainTypo(formData.email.trim());
    if (typoWarning) return typoWarning;
    if (!formData.password && !editingUser) return "Password is required.";
    if (formData.password && formData.password.length < 8) return "Password must be at least 8 characters.";
    if (!editingUser && formData.password !== confirmCreatePassword) return "Passwords do not match.";
    if (formData.school_id && !DIGITS_REGEX.test(formData.school_id)) return "School ID must contain numbers only.";
    if (formData.education_level === "junior_high_school" && formData.course && !NAME_REGEX.test(formData.course)) {
      return "Section must contain letters only.";
    }
    return null;
  }

  function handleReviewCreate() {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError("");
    setShowCreateConfirm(true);
  }

  async function handleCreateSubmit() {
    setFormLoading(true);
    try {
      await api.post("/users", formData);
      setShowCreateConfirm(false);
      setShowCreateModal(false);
      setPage(1);
      setToast(`${formData.name} was added successfully.`);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setShowCreateConfirm(false);
      setFormError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Failed to create user"
      );
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEditSubmit() {
    if (!editingUser) return;
    if (formData.password && formData.password !== confirmEditPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError("");
    setFormLoading(true);
    try {
      await api.put(`/users/${editingUser.id}`, formData);
      setToast(
        formData.password
          ? `${formData.name}'s account was updated and password was changed.`
          : `${formData.name}'s account was updated.`
      );
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Failed to update user"
      );
    } finally {
      setFormLoading(false);
    }
  }

  async function handleRevokeConfirm() {
    if (!revokingUser) return;
    setActionLoading(true);
    try {
      await api.post(`/users/${revokingUser.id}/revoke`);
      setToast(`${revokingUser.name}'s access was permanently revoked.`);
      setRevokingUser(null);
      fetchUsers();
    } catch (err) {
      console.error("Error revoking user:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestrictConfirm() {
    if (!restrictingUser) return;
    setActionLoading(true);
    try {
      await api.post(`/users/${restrictingUser.id}/toggle-restriction`, {
        is_restricted: !restrictingUser.is_restricted,
      });
      setToast(
        !restrictingUser.is_restricted
          ? `${restrictingUser.name} was restricted.`
          : `${restrictingUser.name}'s restriction was lifted.`
      );
      setRestrictingUser(null);
      fetchUsers();
    } catch (err) {
      console.error("Error updating restriction:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprovePasswordChange(user: SystemUser) {
    setApprovingPassword(true);
    try {
      await api.post(`/users/${user.id}/approve-password-change`);
      setToast(`Password change approved for ${user.name}.`);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to approve password change.");
    } finally {
      setApprovingPassword(false);
    }
  }

  async function openRestrictionSettings() {
    setRestrictionError("");
    setShowRestrictionSettings(true);
    try {
      const res = await api.get("/system/trust-settings");
      setRestrictionDays(String(res.data.restriction_days));
      setRestrictionThreshold(String(res.data.restriction_threshold));
    } catch (err) {
      setRestrictionError("Could not load the current settings.");
    }
  }

  async function handleSaveRestrictionSettings() {
    setRestrictionError("");
    setRestrictionSaving(true);
    try {
      await api.put("/system/trust-settings", {
        restriction_days: parseInt(restrictionDays, 10),
        restriction_threshold: parseInt(restrictionThreshold, 10),
      });
      setToast("Restriction settings saved.");
      setShowRestrictionSettings(false);
    } catch (err: any) {
      setRestrictionError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Failed to save the settings."
      );
    } finally {
      setRestrictionSaving(false);
    }
  }

  async function handleAdjustTrustScore() {
    if (!adjustingTrustScore) return;
    const points = parseInt(trustScorePoints);
    if (isNaN(points) || points === 0) {
      setTrustScoreError("Please enter a non-zero number of points.");
      return;
    }
    const resultingScore = adjustingTrustScore.trust_score + points;
    if (resultingScore > 100) {
      setTrustScoreError(`This would exceed the 100 limit. Maximum you can add right now is +${100 - adjustingTrustScore.trust_score}.`);
      return;
    }
    if (resultingScore < 0) {
      setTrustScoreError(`This would go below 0. Maximum you can deduct right now is -${adjustingTrustScore.trust_score}.`);
      return;
    }

    if (!trustScoreReason.trim()) {
      setTrustScoreError("Please provide a reason for this adjustment.");
      return;
    }
    setTrustScoreError("");
    setTrustScoreSubmitting(true);
    try {
      await api.post(`/users/${adjustingTrustScore.id}/adjust-trust-score`, {
        points,
        reason: trustScoreReason.trim(),
      });
      setToast(`${adjustingTrustScore.name}'s trust score adjusted by ${points > 0 ? "+" : ""}${points}.`);
      const cappedScore = Math.max(0, Math.min(100, resultingScore));
      if (editingUser && editingUser.id === adjustingTrustScore.id) {
        setEditingUser({ ...editingUser, trust_score: cappedScore });
      }
      setAdjustingTrustScore(null);
      setTrustScorePoints("");
      setTrustScoreReason("");
      fetchUsers();
    } catch (err: any) {
      setTrustScoreError(err.response?.data?.message || "Failed to adjust trust score.");
    } finally {
      setTrustScoreSubmitting(false);
    }
  }

  const tabLabel = (tab: string) => {
    if (tab === "all") return "All";
    if (tab === "revoked") return "Revoked";
    if (tab === "password_requests") return "Password Requests";
    if (tab === "restricted") return "Restricted";
    return educationLabel(tab);
  };

  return (
    <SuperAdminLayout active="/user-management">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#1a237e] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div>
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-[#1a237e]">User Management</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage student accounts for College, Senior High School, and Junior High School
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={openRestrictionSettings}
              className="bg-white border border-gray-200 hover:border-[#1a237e] text-[#1a237e] font-bold px-5 py-3 rounded-2xl transition"
            >
              Restriction Settings
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-[#1a237e] hover:bg-[#283593] text-white font-bold px-6 py-3 rounded-2xl transition shadow-lg hover:-translate-y-0.5 transform"
            >
              <span>+</span> Create New Student
            </button>
          </div>
        </div>

        {/* Summary cards: 2 columns on small screens, 4 on xl */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">Total Students</p>
            <p className="text-4xl font-black text-[#1a237e] mt-1">{users.length}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">Active Students</p>
            <p className="text-4xl font-black text-green-600 mt-1">{activeCount}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">Revoked Students</p>
            <p className="text-4xl font-black text-red-500 mt-1">{inactiveCount}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">Password Requests</p>
            <p className="text-4xl font-black text-orange-500 mt-1">{pendingPasswordCount}</p>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {(["all", "college", "senior_high_school", "junior_high_school", "restricted", "revoked", "password_requests"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setStudentSubTab(level)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
                studentSubTab === level
                  ? level === "revoked"
                    ? "bg-red-500 text-white shadow-md"
                    : level === "password_requests"
                    ? "bg-orange-500 text-white shadow-md"
                    : level === "restricted"
                    ? "bg-yellow-500 text-white shadow-md"
                    : "bg-[#1a237e] text-white shadow-md"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-[#1a237e] hover:text-[#1a237e]"
              }`}
            >
              {tabLabel(level)}
            </button>
          ))}
        </div>

        {/* Students list card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
            <h2 className="font-black text-gray-700 text-lg">
              {tabLabel(studentSubTab)} {studentSubTab !== "password_requests" && "Students"}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSortOrder("oldest")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                  sortOrder === "oldest" ? "bg-[#1a237e] text-white" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#1a237e]"
                }`}
              >
                Oldest
              </button>
              <button
                onClick={() => setSortOrder("newest")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                  sortOrder === "newest" ? "bg-[#1a237e] text-white" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#1a237e]"
                }`}
              >
                Newest
              </button>
              <select
                value={studentSubTab}
                onChange={(e) => setStudentSubTab(e.target.value as typeof studentSubTab)}
                className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
              >
                {(["all", "college", "senior_high_school", "junior_high_school", "restricted", "revoked", "password_requests"] as const).map((level) => (
                  <option key={level} value={level}>{tabLabel(level)}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search by name, email, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm w-full sm:w-64"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-bold">Loading students...</p>
            </div>
          ) : studentSubTab === "password_requests" ? (
            paginated.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="font-bold text-lg">No pending password requests</p>
                <p className="text-sm mt-1">Requests from students will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {paginated.map((user) => (
                  <div key={user.id} className="px-6 py-5 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-11 h-11 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
                        {getInitial(user.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-700">{user.name}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{user.email} &middot; {user.school_id || "—"}</p>
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mt-3">
                          <p className="text-orange-700 text-xs font-bold uppercase mb-1">Student&apos;s Message</p>
                          <p className="text-orange-600 text-sm">{user.password_change_reason || "No reason provided."}</p>
                        </div>
                        {user.password_change_approved && (
                          <p className="text-green-600 text-xs font-bold mt-2">✓ Approved — waiting for student to set their new password.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {!user.password_change_approved && (
                        <button
                          onClick={() => handleApprovePasswordChange(user)}
                          disabled={approvingPassword}
                          className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition disabled:opacity-50 whitespace-nowrap"
                        >
                          {approvingPassword ? "Approving..." : "Approve Request"}
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(user)}
                        className="bg-blue-50 hover:bg-[#1a237e] hover:text-white text-[#1a237e] text-xs font-bold px-4 py-2 rounded-lg transition whitespace-nowrap"
                      >
                        Set Password Manually
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">User</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Level</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">School ID</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
                            {getInitial(user.name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-700">{user.name}</p>
                              {user.password_change_requested && (
                                <span className="bg-orange-50 text-orange-600 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                  PASSWORD REQUEST
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs mt-0.5">
                              ID: {displayId(user.id)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block bg-blue-50 text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap">
                          {educationLabel(user.education_level)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-600 text-sm font-semibold">{user.school_id || "—"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-500 text-sm">{user.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        {!user.is_active ? (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600">REVOKED</span>
                        ) : user.is_restricted ? (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600">RESTRICTED</span>
                        ) : (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-50 text-green-700">ACTIVE</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            disabled={!user.is_active}
                            className="bg-blue-50 hover:bg-[#1a237e] hover:text-white text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Edit
                          </button>
                          {user.is_active && (
                            <button
                              onClick={() => setRestrictingUser(user)}
                              className={
                                user.is_restricted
                                  ? "bg-green-50 hover:bg-green-600 hover:text-white text-green-600 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                                  : "bg-orange-50 hover:bg-orange-500 hover:text-white text-orange-600 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                              }
                            >
                              {user.is_restricted ? "Unrestrict" : "Restrict"}
                            </button>
                          )}
                          {user.is_active && (
                            <button
                              onClick={() => setRevokingUser(user)}
                              className="bg-red-50 hover:bg-red-600 hover:text-white text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && studentSubTab !== "password_requests" && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="font-bold text-lg">No students found</p>
              <p className="text-sm mt-1">Try searching with a different keyword</p>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-3 items-center justify-between">
            <p className="text-gray-400 text-sm">
              Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
              &ndash;{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} students
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={
                    p === page
                      ? "px-3 py-1.5 bg-[#1a237e] rounded-lg text-white text-sm font-bold"
                      : "px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition"
                  }
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-2xl font-black text-[#1a237e] mb-1">Create New Student</h2>
            <p className="text-gray-400 text-sm mb-6">
              Add a new student account to the system
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: filterLettersOnly(e.target.value) })}
                  placeholder="e.g. Juan Dela Cruz"
                  autoComplete="off"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. juan.delacruz@sjdmcci.edu.ph"
                  autoComplete="off"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    className="w-full mt-1 px-4 py-3 pr-16 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-4 top-1/2 mt-0.5 -translate-y-1/2 text-gray-400 hover:text-[#1a237e] transition text-xs font-bold"
                  >
                    {showCreatePassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Confirm Password
                </label>
                <input
                  type={showCreatePassword ? "text" : "password"}
                  value={confirmCreatePassword}
                  onChange={(e) => setConfirmCreatePassword(e.target.value)}
                  placeholder="Re-enter the password"
                  autoComplete="new-password"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                />
                {confirmCreatePassword && formData.password !== confirmCreatePassword && (
                  <p className="text-red-500 text-xs mt-1">Passwords do not match.</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Education Level
                </label>
                <select
                  value={formData.education_level}
                  onChange={(e) => setFormData({ ...formData, education_level: e.target.value, course: "", year_level: "" })}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                >
                  {EDUCATION_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  School ID
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.school_id}
                  onChange={(e) => setFormData({ ...formData, school_id: filterDigitsOnly(e.target.value) })}
                  placeholder="e.g. 202210043"
                  autoComplete="off"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                />
              </div>

              {formData.education_level === "college" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Course</label>
                    <input
                      type="text"
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                      placeholder="e.g. BSIT, BSED, or Irregular"
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Year Level</label>
                    <select
                      value={formData.year_level}
                      onChange={(e) => setFormData({ ...formData, year_level: e.target.value })}
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    >
                      <option value="">Select Year Level</option>
                      {COLLEGE_YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {formData.education_level === "senior_high_school" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Strand</label>
                    <select
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    >
                      <option value="">Select Strand</option>
                      {STRANDS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Grade Level</label>
                    <select
                      value={formData.year_level}
                      onChange={(e) => setFormData({ ...formData, year_level: e.target.value })}
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    >
                      <option value="">Select Grade Level</option>
                      <option value="Grade 11">Grade 11</option>
                      <option value="Grade 12">Grade 12</option>
                    </select>
                  </div>
                </>
              )}

              {formData.education_level === "junior_high_school" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Section</label>
                    <input
                      type="text"
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: filterLettersOnly(e.target.value) })}
                      placeholder="e.g. Newton"
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Grade Level</label>
                    <select
                      value={formData.year_level}
                      onChange={(e) => setFormData({ ...formData, year_level: e.target.value })}
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    >
                      <option value="">Select Grade Level</option>
                      {JHS_GRADES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {formError && (
                <p className="text-red-500 text-xs font-semibold">{formError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewCreate}
                className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition"
              >
                Review & Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreatePasswordConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-black text-[#1a237e] mb-2">Confirm Password</h2>
            <p className="text-gray-400 text-sm mb-4">Please confirm this is the password you intended to set</p>
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="font-mono font-bold text-gray-700 text-lg break-all">{formData.password}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFormData({ ...formData, password: "" });
                  setShowCreatePasswordConfirm(false);
                }}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Re-type
              </button>
              <button
                onClick={() => {
                  setPasswordFieldLocked(true);
                  setShowCreatePasswordConfirm(false);
                }}
                className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-[#1a237e] mb-1">Confirm New Student</h2>
            <p className="text-gray-400 text-sm mb-6">Please review the details before creating this account</p>

            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 text-sm mb-6">
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 font-medium">Full Name</span>
                <span className="font-bold text-gray-700 text-right">{formData.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 font-medium">Email</span>
                <span className="font-bold text-gray-700 text-right">{formData.email}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 font-medium">Password</span>
                <span className="font-bold text-gray-700 text-right">{formData.password}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 font-medium">Education Level</span>
                <span className="font-bold text-gray-700 text-right">{educationLabel(formData.education_level)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 font-medium">School ID</span>
                <span className="font-bold text-gray-700 text-right">{formData.school_id || "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 font-medium">
                  {formData.education_level === "college" ? "Course" : formData.education_level === "senior_high_school" ? "Strand" : "Section"}
                </span>
                <span className="font-bold text-gray-700 text-right">{formData.course || "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 font-medium">
                  {formData.education_level === "college" ? "Year Level" : "Grade Level"}
                </span>
                <span className="font-bold text-gray-700 text-right">{formData.year_level || "—"}</span>
              </div>
            </div>

            <p className="text-gray-400 text-xs text-center mb-4">Double-check the details above are correct before proceeding.</p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateConfirm(false)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Go Back
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={formLoading}
                className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                {formLoading ? "Creating..." : "Confirm & Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-2xl font-black text-[#1a237e] mb-1">Edit Student</h2>
            <p className="text-gray-400 text-sm mb-6">
              Update {editingUser.name}&apos;s account details
            </p>

            <div className="bg-blue-50 rounded-2xl p-4 mb-5 flex items-center gap-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Trust Score</p>
                <p className="text-2xl font-black text-[#1a237e]">{editingUser.trust_score}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: filterLettersOnly(e.target.value) })}
                  autoComplete="off"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  autoComplete="off"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  New Password (leave blank to keep current)
                </label>
                <div className="relative mt-1">
                  <input
                    type={editPwVisible ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    maxLength={50}
                    className="w-full pl-4 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setEditPwVisible((v) => !v)}
                    title={editPwVisible ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1a237e] transition"
                  >
                    {editPwVisible ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Give this password directly to the student.</p>
              </div>
              {formData.password && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Confirm New Password
                  </label>
                  <input
                    type={editPwVisible ? "text" : "password"}
                    value={confirmEditPassword}
                    onChange={(e) => setConfirmEditPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                  />
                  {confirmEditPassword && formData.password !== confirmEditPassword && (
                    <p className="text-red-500 text-xs mt-1">Passwords do not match.</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Education Level
                </label>
                <select
                  value={formData.education_level}
                  onChange={(e) => setFormData({ ...formData, education_level: e.target.value })}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                >
                  {EDUCATION_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  School ID
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.school_id}
                  onChange={(e) => setFormData({ ...formData, school_id: filterDigitsOnly(e.target.value) })}
                  autoComplete="off"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                />
              </div>

              {formData.education_level === "college" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Course</label>
                    <input
                      type="text"
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                      placeholder="e.g. BSIT, BSED, or Irregular"
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Year Level</label>
                    <select
                      value={formData.year_level}
                      onChange={(e) => setFormData({ ...formData, year_level: e.target.value })}
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    >
                      <option value="">Select Year Level</option>
                      {COLLEGE_YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {formData.education_level === "senior_high_school" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Strand</label>
                    <select
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    >
                      <option value="">Select Strand</option>
                      {STRANDS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Grade Level</label>
                    <select
                      value={formData.year_level}
                      onChange={(e) => setFormData({ ...formData, year_level: e.target.value })}
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    >
                      <option value="">Select Grade Level</option>
                      <option value="Grade 11">Grade 11</option>
                      <option value="Grade 12">Grade 12</option>
                    </select>
                  </div>
                </>
              )}

              {formData.education_level === "junior_high_school" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Section</label>
                    <input
                      type="text"
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: filterLettersOnly(e.target.value) })}
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Grade Level</label>
                    <select
                      value={formData.year_level}
                      onChange={(e) => setFormData({ ...formData, year_level: e.target.value })}
                      className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                    >
                      <option value="">Select Grade Level</option>
                      {JHS_GRADES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {formError && (
                <p className="text-red-500 text-xs font-semibold">{formError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={formLoading}
                className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                {formLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>

            <button
              onClick={() => {
                setAdjustingTrustScore(editingUser);
                setTrustScorePoints("");
                setTrustScoreReason("");
                setTrustScoreError("");
              }}
              className="w-full mt-3 border-2 border-purple-200 text-purple-600 hover:bg-purple-50 font-bold py-3 rounded-2xl transition text-sm"
            >
              Manually Adjust Trust Score
            </button>
          </div>
        </div>
      )}

      {showEditPasswordCheck && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-black text-[#1a237e] mb-2">Confirm Password</h2>
            <p className="text-gray-400 text-sm mb-4">Please confirm this is the password you intended to set</p>
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="font-mono font-bold text-gray-700 text-lg break-all">{formData.password}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFormData({ ...formData, password: "" });
                  setShowEditPasswordCheck(false);
                }}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Re-type
              </button>
              <button
                onClick={() => {
                  setEditPasswordLocked(true);
                  setShowEditPasswordCheck(false);
                }}
                className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {restrictingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-[#1a237e] mb-2">
              {restrictingUser.is_restricted ? "Lift Restriction?" : "Restrict This Account?"}
            </h2>
            <p className="text-gray-400 text-sm mb-8">
              {restrictingUser.is_restricted
                ? `${restrictingUser.name} will regain the ability to log in.`
                : `${restrictingUser.name} will be blocked from logging in. This can be reversed anytime.`}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setRestrictingUser(null)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRestrictConfirm}
                disabled={actionLoading}
                className={`flex-1 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50 ${
                  restrictingUser.is_restricted ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {actionLoading ? "Processing..." : restrictingUser.is_restricted ? "Lift Restriction" : "Restrict"}
              </button>
            </div>
          </div>
        </div>
      )}

      {revokingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-[#1a237e] mb-2">Permanently Revoke Access?</h2>
            <p className="text-gray-400 text-sm mb-3">
              {revokingUser.name} will permanently lose access to their account.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-6">
              <p className="text-red-600 text-xs font-bold">This action CANNOT be undone. There is no restore option once revoked.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRevokingUser(null)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeConfirm}
                disabled={actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                {actionLoading ? "Revoking..." : "Permanently Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestrictionSettings && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-black text-[#1a237e] mb-1">Restriction Settings</h2>
            <p className="text-gray-400 text-sm mb-5">
              Decides when a student is blocked from submitting claims and for how long. Applies to future restrictions only.
            </p>

            <label className="block text-sm font-bold text-gray-600 mb-2">Restrict when trust score falls below</label>
            <select
              value={restrictionThreshold}
              onChange={(e) => setRestrictionThreshold(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700 mb-4"
            >
              {["30", "40", "50", "60", "70"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            <label className="block text-sm font-bold text-gray-600 mb-2">Restriction period</label>
            <select
              value={restrictionDays}
              onChange={(e) => setRestrictionDays(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700 mb-2"
            >
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="0">Until an administrator re-enables access</option>
            </select>
            <p className="text-gray-400 text-xs mb-4">
              Restricted students can also be released at any time using the Restrict button on their account.
            </p>

            {restrictionError && (
              <p className="text-red-500 text-xs font-semibold mb-4">{restrictionError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowRestrictionSettings(false)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRestrictionSettings}
                disabled={restrictionSaving}
                className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                {restrictionSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {adjustingTrustScore && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-black text-[#1a237e] mb-1">Adjust Trust Score</h2>
            <p className="text-gray-400 text-sm mb-5">
              For {adjustingTrustScore.name} &mdash; current score: <strong>{adjustingTrustScore.trust_score}</strong>
            </p>

            <label className="block text-sm font-bold text-gray-600 mb-2">Points (use negative to deduct)</label>
            <input
              type="number"
              value={trustScorePoints}
              onChange={(e) => setTrustScorePoints(e.target.value)}
              placeholder="e.g. 10 or -10"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none transition text-gray-700 mb-2"
            />
            {trustScorePoints && !isNaN(parseInt(trustScorePoints)) && (
              <p className={`text-xs font-semibold mb-4 ${
                adjustingTrustScore.trust_score + parseInt(trustScorePoints) > 100 || adjustingTrustScore.trust_score + parseInt(trustScorePoints) < 0
                  ? "text-red-500"
                  : "text-gray-400"
              }`}>
                New score will be: {Math.max(0, Math.min(100, adjustingTrustScore.trust_score + parseInt(trustScorePoints)))}
                {(adjustingTrustScore.trust_score + parseInt(trustScorePoints) > 100 || adjustingTrustScore.trust_score + parseInt(trustScorePoints) < 0) && " (exceeds limit, will be capped)"}
              </p>
            )}

            <label className="block text-sm font-bold text-gray-600 mb-2">Reason</label>
            <textarea
              value={trustScoreReason}
              onChange={(e) => setTrustScoreReason(e.target.value)}
              placeholder="Explain why this manual adjustment is needed..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none transition text-gray-700 resize-none mb-4"
            />

            {trustScoreError && (
              <p className="text-red-500 text-xs font-semibold mb-4">{trustScoreError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setAdjustingTrustScore(null)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustTrustScore}
                disabled={trustScoreSubmitting}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                {trustScoreSubmitting ? "Saving..." : "Confirm Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}