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
}

const PAGE_SIZE = 5;

const EDUCATION_LEVELS = [
  { value: "college", label: "College" },
  { value: "senior_high_school", label: "Senior High School" },
  { value: "junior_high_school", label: "Junior High School" },
];

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function educationLabel(value: string | null) {
  const found = EDUCATION_LEVELS.find((e) => e.value === value);
  return found ? found.label : value || "—";
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [studentSubTab, setStudentSubTab] = useState<"all" | "college" | "senior_high_school" | "junior_high_school">("all");

  const [viewingUser, setViewingUser] = useState<SystemUser | null>(null);

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
    if (studentSubTab === "all") return users;
    return users.filter((u) => u.education_level === studentSubTab);
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
  const restrictedCount = users.filter((u) => u.is_restricted).length;

  function trustScoreColor(score: number) {
    if (score >= 70) return "text-green-600 bg-green-50";
    if (score >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  }

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
            <a href="/dashboard" className="text-white font-black text-lg block">
              FIND<span className="text-[#ffd700]">NEST</span>
            </a>
            <span className="text-blue-300 text-xs">Admin Panel</span>
          </div>
        </div>

        <div className="mx-6 h-px bg-white/10 mb-4" />

        <nav className="flex flex-col gap-1 px-4 flex-1">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-wider px-4 mb-2">Main Menu</p>
          <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Dashboard</span>
          </a>
          <a href="/item-management" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Item Management</span>
          </a>
          <a href="/claim-verification" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Claim Verification</span>
          </a>
          <a href="/location-analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Location Analytics</span>
          </a>
          <a href="/admin-user-management" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 text-white font-semibold border border-white/20">
            <span>User Management</span>
          </a>
          <a href="/digital-records" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Digital Records</span>
          </a>
          <a href="/admin-support" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Support Inbox</span>
          </a>
        </nav>

        <div className="px-4 py-6">
          <div className="bg-white/10 rounded-2xl p-4 mb-4">
            <p className="text-white text-sm font-semibold">Guidance Counselor</p>
            <p className="text-blue-300 text-xs mt-1">Administrator</p>
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
            <p className="text-gray-400 text-sm mt-1">View student accounts. Accounts are managed by the Super Admin.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
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

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {(["all", "college", "senior_high_school", "junior_high_school"] as const).map((level) => (
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="font-black text-gray-700 text-lg">
              {studentSubTab === "all" ? "All Students" : educationLabel(studentSubTab) + " Students"}
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
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Student</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Level</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">School ID</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Trust Score</th>
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
                        <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600">REVOKED</span>
                      ) : user.is_restricted ? (
                        <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600">RESTRICTED</span>
                      ) : (
                        <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-50 text-green-700">ACTIVE</span>
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
          )}

          {!loading && filtered.length === 0 && (
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
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {viewingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8">
            <button
              onClick={() => setViewingUser(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-2xl font-black text-[#1a237e] mb-1">Student Details</h2>
            <p className="text-gray-400 text-sm mb-6">
              Managed by Super Admin — read-only.
            </p>

            <div className="bg-blue-50 rounded-2xl p-4 mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase">Trust Score</p>
              <p className="text-2xl font-black text-[#1a237e]">{viewingUser.trust_score}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-medium">Full Name</span>
                <span className="font-bold text-gray-700">{viewingUser.name}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-medium">Email</span>
                <span className="font-bold text-gray-700">{viewingUser.email}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-medium">Education Level</span>
                <span className="font-bold text-gray-700">{educationLabel(viewingUser.education_level)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-medium">School ID</span>
                <span className="font-bold text-gray-700">{viewingUser.school_id || "—"}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-medium">
                  {viewingUser.education_level === "senior_high_school" ? "Strand" : viewingUser.education_level === "college" ? "Course" : "Section"}
                </span>
                <span className="font-bold text-gray-700">{viewingUser.course || "—"}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-medium">
                  {viewingUser.education_level === "college" ? "Year Level" : "Grade Level"}
                </span>
                <span className="font-bold text-gray-700">{viewingUser.year_level || "—"}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-medium">Status</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                  !viewingUser.is_active ? "bg-red-50 text-red-600" : viewingUser.is_restricted ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-700"
                }`}>
                  {!viewingUser.is_active ? "REVOKED" : viewingUser.is_restricted ? "RESTRICTED" : "ACTIVE"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setViewingUser(null)}
              className="w-full mt-6 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}