"use client";
import { useState, useMemo, useEffect } from "react";
import api, { logoutUser } from "@/lib/api";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  privileges: string[] | null;
  is_restricted: boolean;
  restriction_reason: string | null;
  restricted_until: string | null;
}

const PAGE_SIZE = 5;

const PRIVILEGE_OPTIONS = [
  { key: "item_management", label: "Item Management" },
  { key: "claim_verification", label: "Claim Verification" },
  { key: "location_analytics", label: "Location Analytics" },
  { key: "digital_records", label: "Digital Records" },
  { key: "support_inbox", label: "Support Inbox" },
];

const NAME_REGEX = /^[A-Za-z\s.'-]*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.con": "gmail.com",
  "yahoo.co": "yahoo.com",
  "yahoo.cm": "yahoo.com",
  "outlook.co": "outlook.com",
};

function filterLettersOnly(value: string) {
  return value.replace(/[^A-Za-z\s.'-]/g, "");
}

function checkEmailDomainTypo(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && COMMON_DOMAIN_TYPOS[domain]) {
    return `Did you mean ${email.split("@")[0]}@${COMMON_DOMAIN_TYPOS[domain]}?`;
  }
  return null;
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function formatRole(role: string) {
  return role.replace("_", " ");
}

export default function AdminManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [mainTab, setMainTab] = useState<"admin" | "super_admin">("admin");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [revokingAdmin, setRevokingAdmin] = useState<AdminUser | null>(null);
  const [editTab, setEditTab] = useState<"credentials" | "privileges" | "restrictions">("credentials");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "admin",
    privileges: [] as string[],
    is_restricted: false,
    restriction_reason: "",
    restricted_until: "",
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
      const allUsers: AdminUser[] = response.data.users || [];
      setUsers(allUsers.filter((u) => u.role === "admin" || u.role === "super_admin"));
    } catch (err) {
      console.error("Error fetching admins:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const baseFiltered = useMemo(() => {
    return users.filter((u) => u.role === mainTab);
  }, [users, mainTab]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return baseFiltered.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  }, [baseFiltered, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [mainTab, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCount = users.filter((a) => a.is_active).length;
  const revokedCount = users.filter((a) => !a.is_active).length;

  function resetForm() {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: mainTab,
      privileges: [],
      is_restricted: false,
      restriction_reason: "",
      restricted_until: "",
    });
    setFormError("");
    setEditTab("credentials");
  }

  function openAssignModal() {
    resetForm();
    setShowAssignModal(true);
  }

  function openEditModal(admin: AdminUser) {
    setFormData({
      name: admin.name,
      email: admin.email,
      password: "",
      role: admin.role,
      privileges: admin.privileges || [],
      is_restricted: admin.is_restricted || false,
      restriction_reason: admin.restriction_reason || "",
      restricted_until: admin.restricted_until || "",
    });
    setFormError("");
    setEditTab("credentials");
    setEditingAdmin(admin);
  }

  function togglePrivilege(key: string) {
    setFormData((prev) => ({
      ...prev,
      privileges: prev.privileges.includes(key)
        ? prev.privileges.filter((p) => p !== key)
        : [...prev.privileges, key],
    }));
  }

  function validateAssignForm(): string | null {
    if (!formData.name.trim()) return "Personnel name is required.";
    if (!NAME_REGEX.test(formData.name)) return "Personnel name must contain letters only.";
    if (!EMAIL_REGEX.test(formData.email.trim())) return "Please enter a complete, valid email address.";
    const typoWarning = checkEmailDomainTypo(formData.email.trim());
    if (typoWarning) return typoWarning;
    if (!formData.password.trim()) return "Password is required.";
    if (formData.password.length < 8) return "Password must be at least 8 characters.";
    return null;
  }

  async function handleAssignSubmit() {
    const validationError = validateAssignForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError("");
    setFormLoading(true);
    try {
      await api.post("/users", formData);
      setShowAssignModal(false);
      setPage(1);
      setToast(`${formData.name} was assigned as ${formatRole(formData.role)}.`);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Failed to assign admin"
      );
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEditSubmit() {
    if (!editingAdmin) return;
    if (!formData.name.trim() || !NAME_REGEX.test(formData.name)) {
      setFormError("Personnel name must contain letters only.");
      return;
    }
    if (!EMAIL_REGEX.test(formData.email.trim())) {
      setFormError("Please enter a complete, valid email address.");
      return;
    }
    setFormError("");
    setFormLoading(true);
    try {
      await api.put(`/users/${editingAdmin.id}`, formData);
      setToast(`${formData.name}'s account was updated.`);
      setEditingAdmin(null);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Failed to update admin"
      );
    } finally {
      setFormLoading(false);
    }
  }

  async function handleRevokeConfirm() {
    if (!revokingAdmin) return;
    try {
      if (revokingAdmin.is_active) {
        await api.post(`/users/${revokingAdmin.id}/revoke`);
        setToast(`${revokingAdmin.name}'s admin access was revoked.`);
      } else {
        await api.post(`/users/${revokingAdmin.id}/restore`);
        setToast(`${revokingAdmin.name}'s admin access was restored.`);
      }
      setRevokingAdmin(null);
      fetchUsers();
    } catch (err) {
      console.error("Error updating admin status:", err);
      setRevokingAdmin(null);
    }
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
            <a href="/user-management" className="text-white font-black text-lg block">
              FIND<span className="text-[#ffd700]">NEST</span>
            </a>
            <span className="text-blue-300 text-xs">Super Admin Panel</span>
          </div>
        </div>

        <div className="mx-6 h-px bg-white/10 mb-4"></div>

        <nav className="flex flex-col gap-1 px-4 flex-1">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-wider px-4 mb-2">Management</p>

          <a
            href="/user-management"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium"
          >
            <span>User Management</span>
          </a>

          <a
            href="/admin-management"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 text-white font-semibold border border-white/20"
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
            <h1 className="text-3xl font-black text-[#1a237e]">Admin Management</h1>
            <p className="text-gray-400 text-sm mt-1">
              Assign or revoke administrator roles and control panel access
            </p>
          </div>
          <button
            onClick={openAssignModal}
            className="flex items-center gap-2 bg-[#1a237e] hover:bg-[#283593] text-white font-bold px-6 py-3 rounded-2xl transition shadow-lg hover:-translate-y-0.5 transform"
          >
            <span>+</span> Assign New Admin
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">Total Admins</p>
            <p className="text-4xl font-black text-[#1a237e] mt-1">{users.length}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">Active Admins</p>
            <p className="text-4xl font-black text-green-600 mt-1">{activeCount}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">Revoked Admins</p>
            <p className="text-4xl font-black text-red-500 mt-1">{revokedCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setMainTab("admin")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              mainTab === "admin"
                ? "bg-[#1a237e] text-white shadow-md"
                : "bg-white text-gray-500 border border-gray-200 hover:border-[#1a237e] hover:text-[#1a237e]"
            }`}
          >
            Admins
          </button>
          <button
            onClick={() => setMainTab("super_admin")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              mainTab === "super_admin"
                ? "bg-[#1a237e] text-white shadow-md"
                : "bg-white text-gray-500 border border-gray-200 hover:border-[#1a237e] hover:text-[#1a237e]"
            }`}
          >
            Super Admins
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="font-black text-gray-700 text-lg">
              {mainTab === "admin" ? "All Admins" : "All Super Admins"}
            </h2>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm w-72"
            />
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-bold">Loading admins...</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Personnel</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50 transition group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
                          {getInitial(admin.name)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-700">{admin.name}</p>
                          <p className="text-gray-400 text-xs mt-0.5">ID: ADM-{String(admin.id).padStart(3, "0")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-50 text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg capitalize">
                        {formatRole(admin.role)}
                      </span>
                      {admin.is_restricted && (
                        <span className="ml-2 bg-orange-50 text-orange-600 text-xs font-bold px-2 py-1 rounded-lg">
                          Restricted
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-500 text-sm">{admin.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${admin.is_active ? "bg-green-500" : "bg-red-500"}`}></div>
                        <span
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                            admin.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                          }`}
                        >
                          {admin.is_active ? "ACTIVE" : "REVOKED"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(admin)}
                          className="bg-blue-50 hover:bg-[#1a237e] hover:text-white text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setRevokingAdmin(admin)}
                          className={
                            admin.is_active
                              ? "bg-red-50 hover:bg-red-500 hover:text-white text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                              : "bg-green-50 hover:bg-green-500 hover:text-white text-green-600 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                          }
                        >
                          {admin.is_active ? "Revoke" : "Restore"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="font-bold text-lg">No admins found</p>
              <p className="text-sm mt-1">Try searching with a different keyword</p>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
              &ndash;{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} admins
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

      {showAssignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8">
            <button
              onClick={() => setShowAssignModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-2xl font-black text-[#1a237e] mb-1">Assign New Admin</h2>
            <p className="text-gray-400 text-sm mb-6">Grant a personnel account admin panel access</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Personnel Name</label>
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
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email</label>
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
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Password</label>
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
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm capitalize"
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {formError && <p className="text-red-500 text-xs font-semibold">{formError}</p>}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={formLoading}
                className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                {formLoading ? "Assigning..." : "Assign Admin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 p-8">
            <button
              onClick={() => setEditingAdmin(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-2xl font-black text-[#1a237e] mb-1">Edit Admin</h2>
            <p className="text-gray-400 text-sm mb-6">Update {editingAdmin.name}&apos;s account details</p>

            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
              <button
                onClick={() => setEditTab("credentials")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  editTab === "credentials" ? "bg-[#1a237e] text-white" : "bg-gray-50 text-gray-500 hover:text-gray-700"
                }`}
              >
                User Credentials
              </button>
              <button
                onClick={() => setEditTab("privileges")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  editTab === "privileges" ? "bg-[#1a237e] text-white" : "bg-gray-50 text-gray-500 hover:text-gray-700"
                }`}
              >
                User Privileges
              </button>
              <button
                onClick={() => setEditTab("restrictions")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  editTab === "restrictions" ? "bg-[#1a237e] text-white" : "bg-gray-50 text-gray-500 hover:text-gray-700"
                }`}
              >
                Restrictions
              </button>
            </div>

            {editTab === "credentials" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Personnel Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: filterLettersOnly(e.target.value) })}
                    autoComplete="off"
                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email</label>
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
                    autoComplete="new-password"
                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm capitalize"
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>
            )}

            {editTab === "privileges" && (
              <div className="space-y-2">
                <p className="text-gray-400 text-xs mb-3">Checked pages are accessible to this account. Uncheck a page to block it.</p>
                {PRIVILEGE_OPTIONS.map((priv) => (
                  <label
                    key={priv.key}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:border-[#1a237e] transition"
                  >
                    <input
                      type="checkbox"
                      checked={!formData.privileges.includes(priv.key)}
                      onChange={() => togglePrivilege(priv.key)}
                      className="w-4 h-4 accent-[#1a237e]"
                    />
                    <span className="text-sm font-semibold text-gray-700">{priv.label}</span>
                  </label>
                ))}
              </div>
            )}

            {editTab === "restrictions" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-bold text-gray-700 text-sm">Suspend Account</p>
                    <p className="text-gray-400 text-xs mt-0.5">Temporarily block access to the admin panel</p>
                  </div>
                  <button
                    onClick={() => setFormData({ ...formData, is_restricted: !formData.is_restricted })}
                    className={`w-12 h-6 rounded-full transition-all duration-300 relative ${
                      formData.is_restricted ? "bg-red-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${
                        formData.is_restricted ? "left-6" : "left-0.5"
                      }`}
                    ></span>
                  </button>
                </div>

                {formData.is_restricted && (
                  <>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Reason</label>
                      <textarea
                        value={formData.restriction_reason}
                        onChange={(e) => setFormData({ ...formData, restriction_reason: e.target.value })}
                        placeholder="Reason for restriction..."
                        rows={3}
                        className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        Restricted Until (optional)
                      </label>
                      <input
                        type="date"
                        value={formData.restricted_until}
                        onChange={(e) => setFormData({ ...formData, restricted_until: e.target.value })}
                        className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {formError && <p className="text-red-500 text-xs font-semibold mt-4">{formError}</p>}

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setEditingAdmin(null)}
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

      {revokingAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center">
            <h2 className="text-xl font-black text-[#1a237e] mb-2">
              {revokingAdmin.is_active ? "Revoke Admin Access?" : "Restore Admin Access?"}
            </h2>
            <p className="text-gray-400 text-sm mb-8">
              {revokingAdmin.is_active
                ? `${revokingAdmin.name} will lose access to the admin panel immediately.`
                : `${revokingAdmin.name} will regain access to the admin panel.`}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setRevokingAdmin(null)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeConfirm}
                className={`flex-1 text-white font-bold py-3 rounded-2xl transition ${
                  revokingAdmin.is_active ? "bg-red-500 hover:bg-red-600" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {revokingAdmin.is_active ? "Revoke" : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}