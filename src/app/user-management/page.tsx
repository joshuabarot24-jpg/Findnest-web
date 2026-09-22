"use client";
import { useState, useMemo, useEffect } from "react";
import api, { logoutUser } from "@/lib/api";

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

function checkEmailDomainTypo(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && COMMON_DOMAIN_TYPOS[domain]) {
    return `Did you mean ${email.split("@")[0]}@${COMMON_DOMAIN_TYPOS[domain]}?`;
  }
  return null;
}

function filterLettersOnly(value: string) {
  return value.replace(/[^A-Za-z\s.'-]/g, "");
}

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
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [studentSubTab, setStudentSubTab] = useState<"all" | "college" | "senior_high_school" | "junior_high_school" | "revoked" | "password_requests">("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

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

  const baseFiltered = useMemo(() => {
    if (studentSubTab === "all") return users.filter((u) => u.is_active);
    if (studentSubTab === "revoked") return users.filter((u) => !u.is_active);
    if (studentSubTab === "password_requests") return users.filter((u) => u.password_change_requested);
    return users.filter((u) => u.education_level === studentSubTab && u.is_active);
  }, [users, studentSubTab]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return baseFiltered.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.school_id || "").toLowerCase().includes(q)
    );
  }, [baseFiltered, search]);

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
    setEditingUser(user);
  }

  function validateForm(): string | null {
    if (!formData.name.trim()) return "Full name is required.";
    if (!NAME_REGEX.test(formData.name)) return "Full name must contain letters only.";
    if (!EMAIL_REGEX.test(formData.email.trim())) return "Please enter a complete, valid email address.";
    const typoWarning = checkEmailDomainTypo(formData.email.trim());
    if (typoWarning) return typoWarning;
    if (!formData.password && !editingUser) return "Password is required.";
    if (formData.password && formData.password.length < 8) return "Password must be at least 8 characters.";
    if (formData.school_id && !DIGITS_REGEX.test(formData.school_id)) return "School ID must contain numbers only.";
    if (formData.education_level === "junior_high_school" && formData.course && !NAME_REGEX.test(formData.course)) {
      return "Section must contain letters only.";
    }
    return null;
  }

  async function handleCreateSubmit() {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError("");
    setFormLoading(true);
    try {
      await api.post("/users", formData);
      setShowCreateModal(false);
      setPage(1);
      setToast(`${formData.name} was added successfully.`);
      resetForm();
      fetchUsers();
    } catch (err: any) {
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

  const tabLabel = (tab: string) => {
    if (tab === "all") return "All";
    if (tab === "revoked") return "Revoked";
    if (tab === "password_requests") return "Password Requests";
    return educationLabel(tab);
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#1a237e] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <aside className="w-72 bg-[#1a237e] min-h-screen flex flex-col fixed left-0 top-0 bottom-0">
        <div className="flex items-center gap-3 px-6 py-6">
          <div>
            <a href="/user-management" className="text-white font-black text-lg block">
              FIND<span className="text-[#ffd700]">NEST</span>
            </a>
            <span className="text-blue-300 text-xs">Super Admin Panel</span>
          </div>
        </div>

        <div className="mx-6 h-px bg-white/10 mb-4"></div>

        <nav className="flex flex-col gap-1 px-4 flex-1">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-wider px-4 mb-2">
            Management
          </p>

          <a
            href="/user-management"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 text-white font-semibold border border-white/20"
          >
            <span>User Management</span>
          </a>

          <a
            href="/admin-management"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium"
          >
            <span>Admin Management</span>
          </a>

          <a
            href="/system-management"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium"
          >
            <span>System Management</span>
          </a>

          <a
            href="/super-admin-records"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium"
          >
            <span>Digital Records</span>
          </a>
        </nav>

        <div className="px-4 py-6">
          <div className="bg-white/10 rounded-2xl p-4 mb-4">
            <p className="text-white text-sm font-semibold">Super Admin</p>
            <p className="text-blue-300 text-xs mt-1">System Administrator</p>
          </div>

          <button
            onClick={logoutUser}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium w-full text-left"
          >
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-72 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-[#1a237e]">User Management</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage student accounts for College, Senior High School, and Junior High School
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#1a237e] hover:bg-[#283593] text-white font-bold px-6 py-3 rounded-2xl transition shadow-lg hover:-translate-y-0.5 transform"
          >
            <span>+</span> Create New Student
          </button>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
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

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {(["all", "college", "senior_high_school", "junior_high_school", "revoked", "password_requests"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setStudentSubTab(level)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
                studentSubTab === level
                  ? level === "revoked"
                    ? "bg-red-500 text-white shadow-md"
                    : level === "password_requests"
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-[#1a237e] text-white shadow-md"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-[#1a237e] hover:text-[#1a237e]"
              }`}
            >
              {tabLabel(level)}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="font-black text-gray-700 text-lg">
              {tabLabel(studentSubTab)} {studentSubTab !== "password_requests" && "Students"}
            </h2>
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm w-72"
            />
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
                  <div key={user.id} className="px-6 py-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-11 h-11 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
                        {getInitial(user.name)}
                      </div>
                      <div className="flex-1">
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
            <table className="w-full">
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
                            ID: USR-{String(user.id).padStart(3, "0")}
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
          )}

          {!loading && studentSubTab !== "password_requests" && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="font-bold text-lg">No students found</p>
              <p className="text-sm mt-1">Try searching with a different keyword</p>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
              &ndash;{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} students
            </p>
            <div className="flex items-center gap-2">
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
      </main>

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
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                />
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
                onClick={handleCreateSubmit}
                disabled={formLoading}
                className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                {formLoading ? "Creating..." : "Create Student"}
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
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Give this password directly to the student.</p>
              </div>

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
          </div>
        </div>
      )}

      {restrictingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center">
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
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center">
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
    </div>
  );
}