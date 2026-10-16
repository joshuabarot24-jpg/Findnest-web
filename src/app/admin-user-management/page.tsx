"use client";
// Admin > User Management (/admin-user-management). Read-only student list; accounts are managed by the Super Admin.
// API: GET /users, /support (override requests), POST /users/{id}/toggle-manual-override, /support/{id}/resolve-override
import { useState, useMemo, useEffect } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import AdminLayout from "@/components/AdminLayout";
import StudentActivityModal from "@/components/StudentActivityModal";
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
  flagged_for_review?: boolean;
  flag_reason?: string | null;
  manual_override_granted?: boolean;
  profile_photo_url?: string | null;
}

const PAGE_SIZE = 5;
const TH = "text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider";
const LEVELS = ["all", "college", "senior_high_school", "junior_high_school"] as const;

const EDUCATION_LEVELS = [
  { value: "college", label: "College" },
  { value: "senior_high_school", label: "Senior High School" },
  { value: "junior_high_school", label: "Junior High School" },
];

// Shows the student's photo, or their initial when there is none
function AvatarInner({ user }: { user: { name: string; profile_photo_url?: string | null } }) {
  return user.profile_photo_url ? (
    <img src={user.profile_photo_url} alt="" className="w-full h-full object-cover" />
  ) : (
    <>{getInitial(user.name)}</>
  );
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function educationLabel(value: string | null) {
  const found = EDUCATION_LEVELS.find((e) => e.value === value);
  return found ? found.label : value || "—";
}

// Label/value row used in the View popup
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
      <span className="text-gray-400 font-medium">{label}</span>
      {children}
    </div>
  );
}

export default function AdminUserManagement() {
  return (
    <AuthGate allowedRole="admin">
      <AdminUserManagementContent />
    </AuthGate>
  );
}

function AdminUserManagementContent() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "restricted" | "archived">("all");
  const [studentSubTab, setStudentSubTab] = useState<(typeof LEVELS)[number]>("all");

  const [viewingUser, setViewingUser] = useState<SystemUser | null>(null);
  const [activityUser, setActivityUser] = useState<SystemUser | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [overrideRequests, setOverrideRequests] = useState<{ id: number; name: string; email: string; message: string; override_status: string; created_at: string }[]>([]);
  const [overrideLoading, setOverrideLoading] = useState(true);
  const [resolvingOverrideId, setResolvingOverrideId] = useState<number | null>(null);
  const [togglingOverride, setTogglingOverride] = useState(false);

  // Turns the Manual AI Override on or off for one student
  async function handleToggleOverride(user: SystemUser) {
    setTogglingOverride(true);
    try {
      const res = await api.post(`/users/${user.id}/toggle-manual-override`, {
        manual_override_granted: !user.manual_override_granted,
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? res.data.user : u)));
      if (viewingUser?.id === user.id) setViewingUser(res.data.user);
      setToast(res.data.message);
    } catch (err) {
      setToast("Failed to update override status.");
    } finally {
      setTogglingOverride(false);
    }
  }

  // Pending manual-override requests sent through Support
  const fetchOverrideRequests = async () => {
    try {
      const response = await api.get("/support");
      const all = response.data.messages || [];
      setOverrideRequests(all.filter((m: any) => m.is_override_request && m.override_status === "pending"));
    } catch (err) {
      console.error("Error fetching override requests:", err);
    } finally {
      setOverrideLoading(false);
    }
  };

  async function handleResolveOverride(id: number, decision: "approve" | "deny") {
    setResolvingOverrideId(id);
    try {
      await api.post(`/support/${id}/resolve-override`, { decision });
      setToast(`Override request ${decision}d.`);
      fetchOverrideRequests();
    } catch (err) {
      setToast("Failed to resolve request.");
    } finally {
      setResolvingOverrideId(null);
    }
  }

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
    fetchOverrideRequests();
  }, []);
  useAutoRefresh(fetchUsers);
  useAutoRefresh(fetchOverrideRequests);

  // Education level first, then status. Status follows the table badge:
  // archived > restricted > active. Archived accounts show under "All Status" and "Archived" only.
  const baseFiltered = useMemo(() => {
    const byLevel = studentSubTab === "all" ? users : users.filter((u) => u.education_level === studentSubTab);
    if (statusFilter === "active") return byLevel.filter((u) => u.is_active && !u.is_restricted);
    if (statusFilter === "restricted") return byLevel.filter((u) => u.is_active && u.is_restricted);
    if (statusFilter === "archived") return byLevel.filter((u) => !u.is_active);
    return byLevel;
  }, [users, studentSubTab, statusFilter]);

  // Search on top of the filters (also matches the status words)
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return baseFiltered;
    return baseFiltered.filter((u) => {
      const statusLabel = !u.is_active ? "archived inactive" : u.is_restricted ? "restricted" : "active";
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.school_id || "").toLowerCase().includes(q) ||
        (u.course || "").toLowerCase().includes(q) ||
        (u.year_level || "").toLowerCase().includes(q) ||
        (u.education_level || "").toLowerCase().includes(q) ||
        educationLabel(u.education_level).toLowerCase().includes(q) ||
        statusLabel.includes(q)
      );
    });
  }, [baseFiltered, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [studentSubTab, search, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCount = users.filter((u) => u.is_active).length;
  const restrictedCount = users.filter((u) => u.is_restricted).length;

  function trustScoreColor(score: number) {
    if (score >= 70) return "text-green-600 bg-green-50";
    if (score >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  }

  // Numbered pager: first, last and the pages next to the current one
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  return (
    <AdminLayout active="/admin-user-management">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#1a237e] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[#06321C]">User Management</h1>
        <p className="text-gray-400 text-sm mt-1">View student accounts. Accounts are managed by the Super Admin.</p>
      </div>

      {/* Pending manual override requests */}
      {!overrideLoading && overrideRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
          <h2 className="font-black text-amber-800 text-lg mb-1">⚠ Pending Manual Override Requests ({overrideRequests.length})</h2>
          <p className="text-amber-700 text-xs mb-4">Students requesting to bypass AI photo analysis due to an unclear photo.</p>
          <div className="space-y-3">
            {overrideRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-xl p-4 flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-[12rem]">
                  <p className="font-bold text-gray-700 text-sm">{req.name} <span className="text-gray-400 font-normal text-xs break-all">({req.email})</span></p>
                  <p className="text-gray-500 text-xs mt-1">{req.message}</p>
                  <p className="text-gray-400 text-[10px] mt-1">{new Date(req.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleResolveOverride(req.id, "approve")}
                    disabled={resolvingOverrideId === req.id}
                    className="bg-green-50 hover:bg-green-500 hover:text-white text-green-600 text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleResolveOverride(req.id, "deny")}
                    disabled={resolvingOverrideId === req.id}
                    className="bg-red-50 hover:bg-red-500 hover:text-white text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards: 1 column on small screens, 3 from sm */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Total Students</p>
          <p className="text-4xl font-black text-[#1a237e] mt-1">{users.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Active Accounts</p>
          <p className="text-4xl font-black text-green-600 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Restricted Accounts</p>
          <p className="text-4xl font-black text-orange-500 mt-1">{restrictedCount}</p>
        </div>
      </div>

      {/* Education level tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setStudentSubTab(level)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              studentSubTab === level
                ? "bg-[#1a237e] text-white shadow-md"
                : "bg-white text-gray-500 border border-gray-200 hover:border-[#1a237e] hover:text-[#1a237e]"
            }`}
          >
            {level === "all" ? "All" : educationLabel(level)}
          </button>
        ))}
      </div>

      {/* Students list: 5 rows per page */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
          <h2 className="font-black text-gray-700 text-lg">
            {studentSubTab === "all" ? "All Students" : educationLabel(studentSubTab) + " Students"}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={studentSubTab}
              onChange={(e) => setStudentSubTab(e.target.value as typeof studentSubTab)}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>{level === "all" ? "All" : educationLabel(level)}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="restricted">Restricted</option>
              <option value="archived">Archived</option>
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Student", "Level", "School ID", "Trust Score", "Status", "Actions"].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-xl overflow-hidden flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
                          <AvatarInner user={user} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-700">{user.name}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{user.email}</p>
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
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${trustScoreColor(user.trust_score)}`}>
                        {user.trust_score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {!user.is_active ? (
                        <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600">ARCHIVED</span>
                      ) : user.is_restricted ? (
                        <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600">RESTRICTED</span>
                      ) : (
                        <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-50 text-green-700">ACTIVE</span>
                      )}
                      {user.flagged_for_review && (
                        <span className="ml-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600" title={user.flag_reason || ""}>⚠ Flagged</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setViewingUser(user)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length === 0 && (
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
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {pageNums.map((p, idx) => (
              <span key={p} className="flex items-center gap-2">
                {idx > 0 && p - pageNums[idx - 1] > 1 && <span className="text-gray-300">&hellip;</span>}
                <button
                  onClick={() => setPage(p)}
                  className={
                    p === page
                      ? "px-3 py-1.5 bg-[#1a237e] rounded-lg text-white text-sm font-bold"
                      : "px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition"
                  }
                >
                  {p}
                </button>
              </span>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Student details (read-only) with the Manual AI Override toggle */}
      {viewingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setViewingUser(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <div className="w-20 h-20 mb-3 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-full overflow-hidden flex items-center justify-center text-white font-black text-3xl shadow-lg ring-4 ring-white">
              <AvatarInner user={viewingUser} />
            </div>
            <h2 className="text-2xl font-black text-[#1a237e] mb-1">Student Details</h2>
            <p className="text-gray-400 text-sm mb-6">Managed by Super Admin — read-only.</p>

            <div className="bg-blue-50 rounded-2xl p-4 mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase">Trust Score</p>
              <p className="text-2xl font-black text-[#1a237e]">{viewingUser.trust_score}</p>
            </div>

            <div className="space-y-3 text-sm mb-4">
              <DetailRow label="Full Name"><span className="font-bold text-gray-700 text-right">{viewingUser.name}</span></DetailRow>
              <DetailRow label="Email"><span className="font-bold text-gray-700 text-right break-all">{viewingUser.email}</span></DetailRow>
              <DetailRow label="Education Level"><span className="font-bold text-gray-700 text-right">{educationLabel(viewingUser.education_level)}</span></DetailRow>
              <DetailRow label="School ID"><span className="font-bold text-gray-700 text-right">{viewingUser.school_id || "—"}</span></DetailRow>
              <DetailRow label={viewingUser.education_level === "senior_high_school" ? "Strand" : viewingUser.education_level === "college" ? "Course" : "Section"}>
                <span className="font-bold text-gray-700 text-right">{viewingUser.course || "—"}</span>
              </DetailRow>
              <DetailRow label={viewingUser.education_level === "college" ? "Year Level" : "Grade Level"}>
                <span className="font-bold text-gray-700 text-right">{viewingUser.year_level || "—"}</span>
              </DetailRow>
              <DetailRow label="Status">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                  !viewingUser.is_active ? "bg-gray-100 text-gray-600" : viewingUser.is_restricted ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-700"
                }`}>
                  {!viewingUser.is_active ? "ARCHIVED" : viewingUser.is_restricted ? "RESTRICTED" : "ACTIVE"}
                </span>
              </DetailRow>
            </div>

            {viewingUser.flagged_for_review && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-red-700 text-xs font-bold">⚠ Flagged For Review</p>
                <p className="text-red-600 text-[11px] mt-0.5">{viewingUser.flag_reason || "This student has a history of rejected claims and appeals."}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl mb-4">
              <div>
                <p className="font-bold text-gray-700 text-sm">Manual AI Override</p>
                <p className="text-gray-400 text-xs">{viewingUser.manual_override_granted ? "Active — AI photo analysis is skipped for this student" : "Off — normal AI analysis applies"}</p>
              </div>
              <button
                onClick={() => handleToggleOverride(viewingUser)}
                disabled={togglingOverride}
                className={`relative w-12 h-6 shrink-0 rounded-full transition-colors ${viewingUser.manual_override_granted ? "bg-amber-500" : "bg-gray-300"} disabled:opacity-50`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${viewingUser.manual_override_granted ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>

            <button
              onClick={() => setActivityUser(viewingUser)}
              className="w-full mt-3 border-2 border-[#1a237e] text-[#1a237e] hover:bg-blue-50 font-bold py-3 rounded-2xl transition"
            >
              See student&apos;s postings
            </button>
            <button
              onClick={() => setViewingUser(null)}
              className="w-full mt-3 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {activityUser && (
        <StudentActivityModal
          studentId={activityUser.id}
          studentName={activityUser.name}
          onClose={() => setActivityUser(null)}
        />
      )}
    </AdminLayout>
  );
}