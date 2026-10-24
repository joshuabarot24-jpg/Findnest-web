"use client";
// Admin > Claim Verification (/claim-verification). Review student claims through the 5-layer check.
// API: GET /claims, POST /claims/{id}/approve | reject | collected
import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import AdminLayout from "@/components/AdminLayout";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

interface OwnershipQuestion {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  student_answer: string | null;
}

interface Claim {
  id: number;
  claim_status: "pending" | "approved" | "rejected" | "abandoned";
  proof_description: string | null;
  proof_photo_url: string | null;
  proof_photo_urls: string[] | null;
  photo_similarity_score: number | null;
  competing_claims_count?: number;
  admin_notes: string | null;
  verification_skipped?: boolean;
  verification_skip_reason?: string | null;
  claimed_at: string | null;
  collected_at: string | null;
  created_at: string;
  ownership_questions: OwnershipQuestion[];
  student: {
    id: number;
    name: string;
    email: string;
    school_id: string | null;
    course: string | null;
    year_level: string | null;
    trust_score: number;
    profile_photo_url?: string | null;
  } | null;
  match: {
    id: number;
    confidence_score: number | null;
    match_status: string;
    attributes: {
      description_score?: number;
      photo_score?: number;
      category_score?: number;
      date_score?: number;
      location_score?: number;
    } | null;
    lost_report: {
      id: number;
      item_name: string;
      category: string;
      description: string | null;
      ai_description: string | null;
      approx_time: string | null;
      primary_color: string | null;
      brand_model: string | null;
      location_lost: string;
      date_lost: string;
      photo_url: string | null;
    } | null;
    found_record: {
      id: number;
      item_name: string;
      category: string;
      description: string | null;
      ai_description: string | null;
      approx_time: string | null;
      primary_color: string | null;
      brand_model: string | null;
      location_found: string;
      storage_location: string | null;
      date_found: string | null;
      photo_url: string | null;
    } | null;
  } | null;
}

const PAGE_SIZE = 5;
const TH = "text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider";
const CATEGORIES = ["Electronics", "Personal Belongings", "ID/Cards", "Keys", "School Supplies", "Accessories", "Books", "Vapes", "Others"];

// Dot + badge + label for a claim's status
function statusStyles(status: string, collectedAt?: string | null) {
  if (status === "approved" && collectedAt) {
    return { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700", label: "Collected" };
  }
  switch (status) {
    case "approved":
      return { dot: "bg-green-500", badge: "bg-green-50 text-green-700", label: "Approved" };
    case "rejected":
      return { dot: "bg-red-500", badge: "bg-red-50 text-red-600", label: "Rejected" };
    case "abandoned":
      return { dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600", label: "Abandoned" };
    default:
      return { dot: "bg-yellow-400", badge: "bg-yellow-50 text-yellow-700", label: "Pending" };
  }
}

// Correct / answered count for the secret questions (null when none answered)
function questionScore(questions: OwnershipQuestion[]) {
  const answered = questions.filter((q) => q.student_answer !== null);
  if (answered.length === 0) return null;
  const correct = answered.filter((q) => q.student_answer === q.correct_option).length;
  return { correct, total: answered.length };
}

// Numbered pager: shows first, last and the pages next to the current one
function Pager({ page, pages, total, label, onChange }: { page: number; pages: number; total: number; label: string; onChange: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pages || Math.abs(p - page) <= 1
  );
  return (
    <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-3 items-center justify-between">
      <p className="text-gray-400 text-sm">Showing {from}&ndash;{to} of {total} {label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        {nums.map((p, idx) => (
          <span key={p} className="flex items-center gap-2">
            {idx > 0 && p - nums[idx - 1] > 1 && <span className="text-gray-300">&hellip;</span>}
            <button
              onClick={() => onChange(p)}
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
          onClick={() => onChange(Math.min(pages, page + 1))}
          disabled={page === pages}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function ClaimVerification() {
  return (
    <AuthGate allowedRole="admin">
      <ClaimVerificationContent />
    </AuthGate>
  );
}

function ClaimVerificationContent() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "10d" | "15d" | "30d">("all");
  const [page, setPage] = useState(1);
  const [viewingClaim, setViewingClaim] = useState<Claim | null>(null);
  const [rejectingClaim, setRejectingClaim] = useState<Claim | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [comparingClaim, setComparingClaim] = useState<Claim | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<Claim | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Loads claims. The backend decides which competing claim is visible (sequential queue).
  const fetchClaims = async () => {
    try {
      const res = await api.get("/claims");
      setClaims(res.data.claims || []);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
      } else {
        console.error("Error fetching claims:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClaims(); }, []);
  useAutoRefresh(fetchClaims);

  // Locks page scroll while a popup is open
  useEffect(() => {
    const anyModalOpen = !!viewingClaim || !!rejectingClaim || !!comparingClaim || !!viewingEvidence;
    if (anyModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
    };
  }, [viewingClaim, rejectingClaim, comparingClaim, viewingEvidence]);

  // Status filter, then category + date range (Manila time), then search
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const byStatus = claims.filter((c) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "multiple") return c.claim_status === "pending" && (c.competing_claims_count ?? 1) > 1;
      if (statusFilter === "approved") return c.claim_status === "approved" && !c.collected_at;
      if (statusFilter === "collected") return c.claim_status === "approved" && !!c.collected_at;
      return c.claim_status === statusFilter;
    });
    const manilaDay = (ts: number) =>
      new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const todayKey = manilaDay(Date.now());
    const standardCategories = CATEGORIES.filter((c) => c !== "Others");
    const byCategoryDate = byStatus.filter((c) => {
      const category = c.match?.found_record?.category || "";
      if (categoryFilter === "Others") {
        if (standardCategories.includes(category)) return false;
      } else if (categoryFilter !== "all" && category !== categoryFilter) {
        return false;
      }
      if (dateRange === "all") return true;
      const ts = new Date(c.created_at).getTime();
      if (dateRange === "today") return manilaDay(ts) === todayKey;
      const days = { "7d": 7, "10d": 10, "15d": 15, "30d": 30 }[dateRange];
      return ts >= Date.now() - days * 24 * 60 * 60 * 1000;
    });
    if (!q) return byCategoryDate;
    return byCategoryDate.filter((c) => {
      const dateStr = new Date(c.created_at).toLocaleDateString().toLowerCase();
      return (
        (c.student?.name || "").toLowerCase().includes(q) ||
        (c.student?.school_id || "").toLowerCase().includes(q) ||
        (c.match?.found_record?.item_name || "").toLowerCase().includes(q) ||
        (c.match?.found_record?.category || "").toLowerCase().includes(q) ||
        c.claim_status.toLowerCase().includes(q) ||
        (c.match?.confidence_score != null ? `${c.match.confidence_score}%` : "").includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [claims, search, statusFilter, categoryFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pendingCount = claims.filter((c) => c.claim_status === "pending").length;
  const approvedCount = claims.filter((c) => c.claim_status === "approved").length;
  const rejectedCount = claims.filter((c) => c.claim_status === "rejected").length;

  async function handleApprove(claim: Claim) {
    setActionLoading(true);
    try {
      await api.post(`/claims/${claim.id}/approve`);
      setToast(`Claim by ${claim.student?.name || "student"} was approved.`);
      setViewingClaim(null);
      fetchClaims();
    } catch (err) {
      console.error("Approve error:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkCollected(claim: Claim) {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/claims/${claim.id}/collected`);
      // Use the date the server saved, so the row changes right away
      const collectedAt: string = res.data?.claim?.collected_at || new Date().toISOString();
      setClaims((prev) => prev.map((c) => (c.id === claim.id ? { ...c, collected_at: collectedAt } : c)));
      setToast(`Item marked as collected by ${claim.student?.name || "student"}.`);
      setViewingClaim(null);
      // Confirm with the server in the background
      fetchClaims();
    } catch (err) {
      console.error("Mark collected error:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectConfirm() {
    if (!rejectingClaim) return;
    setActionLoading(true);
    try {
      await api.post(`/claims/${rejectingClaim.id}/reject`, {
        admin_notes: rejectNotes.trim() || null,
      });
      setToast(`Claim by ${rejectingClaim.student?.name || "student"} was rejected.`);
      setRejectingClaim(null);
      setRejectNotes("");
      setViewingClaim(null);
      fetchClaims();
    } catch (err) {
      console.error("Reject error:", err);
    } finally {
      setActionLoading(false);
    }
  }

  if (accessDenied) {
    return (
      <AdminLayout active="/claim-verification">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-gray-700 mb-2">Access Restricted</h1>
            <p className="text-gray-400 text-sm">
              Your account does not have permission to view Claim Verification. Contact the Super Admin if you believe this is a mistake.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active="/claim-verification">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#1a237e] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[#06321C]">Claim Verification</h1>
        <p className="text-gray-400 text-sm mt-1">Review and process student item claims through the 5-layer verification system</p>
      </div>

      {/* Stat cards: 1 column on small screens, 3 from sm */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Pending Review</p>
          <p className="text-4xl font-black text-yellow-500 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Approved Claims</p>
          <p className="text-4xl font-black text-green-600 mt-1">{approvedCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Rejected Claims</p>
          <p className="text-4xl font-black text-red-500 mt-1">{rejectedCount}</p>
        </div>
      </div>

      {/* Claims list: 5 rows per page */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
          <h2 className="font-black text-gray-700 text-lg">All Claims</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
            >
              <option value="all">All Claims</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved (Not Collected)</option>
              <option value="collected">Collected</option>
              <option value="rejected">Rejected</option>
              <option value="abandoned">Abandoned</option>
              <option value="multiple">Multiple Claimants</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={dateRange}
              onChange={(e) => { setDateRange(e.target.value as typeof dateRange); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="10d">Last 10 Days</option>
              <option value="15d">Last 15 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <input
              type="text"
              placeholder="Search by student, item, or status..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm w-full sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading claims...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Claimant", "Item Claimed", "AI Score", "Status", "Submitted", "Actions"].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((claim) => {
                  const styles = statusStyles(claim.claim_status, claim.collected_at);
                  return (
                    <tr key={claim.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-xl overflow-hidden flex items-center justify-center text-white font-black text-sm shrink-0">
                            {claim.student?.profile_photo_url ? (
                              <img src={claim.student.profile_photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (claim.student?.name || "?").charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-700 text-sm">{claim.student?.name || "Unknown"}</p>
                            <p className="text-gray-400 text-xs">{claim.student?.school_id || claim.student?.email || ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-700 text-sm">{claim.match?.found_record?.item_name || "—"}</p>
                          {claim.claim_status === "pending" && (claim.competing_claims_count ?? 1) > 1 && (
                            <span className="bg-orange-50 text-orange-600 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                              {claim.competing_claims_count} CLAIMANTS
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5">{claim.match?.found_record?.category || ""}</p>
                      </td>
                      <td className="px-6 py-4">
                        {claim.match?.confidence_score != null ? (
                          <button
                            onClick={() => setComparingClaim(claim)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition hover:ring-2 hover:ring-offset-1 cursor-pointer whitespace-nowrap ${
                              claim.match.confidence_score >= 80
                                ? "bg-green-50 text-green-700 hover:ring-green-300"
                                : claim.match.confidence_score >= 60
                                ? "bg-yellow-50 text-yellow-700 hover:ring-yellow-300"
                                : "bg-red-50 text-red-600 hover:ring-red-300"
                            }`}
                          >
                            {claim.match.confidence_score}% &middot; Compare
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">Pending AI</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${styles.badge}`}>{styles.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-400 text-sm">{new Date(claim.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setViewingClaim(claim)}
                          className="bg-blue-50 hover:bg-[#1a237e] hover:text-white text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg transition"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="font-bold text-lg">No claims found</p>
            <p className="text-sm mt-1">Claims will appear here once students submit them</p>
          </div>
        )}

        <Pager page={Math.min(page, totalPages)} pages={totalPages} total={filtered.length} label="claims" onChange={setPage} />
      </div>

      
      {/* Claim review */}
      {viewingClaim && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setViewingClaim(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none">&times;</button>

            <h2 className="text-2xl font-black text-[#1a237e] mb-1">Claim Review</h2>
            <p className="text-gray-400 text-sm mb-6">Claim #{String(viewingClaim.id).padStart(4, "0")} &mdash; submitted {new Date(viewingClaim.created_at).toLocaleString()}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Claimant</p>
                <div className="w-16 h-16 mb-2 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-full overflow-hidden flex items-center justify-center text-white font-black text-2xl shadow ring-2 ring-white">
                  {viewingClaim.student?.profile_photo_url ? (
                    <img src={viewingClaim.student.profile_photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (viewingClaim.student?.name || "?").charAt(0).toUpperCase()
                  )}
                </div>
                <p className="font-black text-gray-700">{viewingClaim.student?.name || "Unknown"}</p>
                <p className="text-gray-400 text-xs mt-1 break-all">{viewingClaim.student?.email}</p>
                <p className="text-gray-400 text-xs">{viewingClaim.student?.school_id} &mdash; {viewingClaim.student?.course} {viewingClaim.student?.year_level}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Trust Score:</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                    (viewingClaim.student?.trust_score ?? 100) >= 70
                      ? "bg-green-50 text-green-700"
                      : (viewingClaim.student?.trust_score ?? 100) >= 40
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-red-50 text-red-600"
                  }`}>
                    {viewingClaim.student?.trust_score ?? 100}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Item Being Claimed</p>
                {viewingClaim.match?.found_record?.photo_url && (
                  <img src={viewingClaim.match.found_record.photo_url} alt="Found item" className="w-full h-24 object-contain rounded-xl mb-2" />
                )}
                <p className="font-black text-gray-700">{viewingClaim.match?.found_record?.item_name || "—"}</p>
                <p className="text-gray-400 text-xs mt-1">{viewingClaim.match?.found_record?.category}</p>
                <p className="text-gray-400 text-xs">Found at: {viewingClaim.match?.found_record?.location_found}</p>
                <p className="text-gray-400 text-xs">Storage: {viewingClaim.match?.found_record?.storage_location || "—"}</p>
                {viewingClaim.claim_status === "pending" && (viewingClaim.competing_claims_count ?? 1) > 1 && (
                  <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-2.5">
                    <p className="text-orange-700 text-xs font-bold">
                      ⚠ {(viewingClaim.competing_claims_count ?? 1) - 1} other student{(viewingClaim.competing_claims_count ?? 1) - 1 !== 1 ? "s are" : " is"} also waiting for this item. If you reject this claim, the next one will be reviewed automatically.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3">Original Lost Report</p>
              <div className="flex items-center gap-4">
                {viewingClaim.match?.lost_report?.photo_url && (
                  <img src={viewingClaim.match.lost_report.photo_url} alt="Lost item" className="w-20 h-20 object-contain rounded-xl flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-black text-gray-700">{viewingClaim.match?.lost_report?.item_name || "—"}</p>
                  <p className="text-gray-400 text-xs mt-1">Lost at: {viewingClaim.match?.lost_report?.location_lost}</p>
                  <p className="text-gray-400 text-xs">Date lost: {viewingClaim.match?.lost_report?.date_lost}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3">5-Layer Verification</p>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600 font-medium">Layer 1 &mdash; Identity Check</span>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">Student Verified</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600 font-medium">Layer 2 &mdash; Found Item Report</span>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{viewingClaim.match ? "Match Linked" : "No Match"}</span>
                </div>
                <button
                  onClick={() => setViewingEvidence(viewingClaim)}
                  className="w-full flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-200 hover:bg-blue-50 transition rounded-lg px-2 -mx-2 text-left"
                >
                  <span className="text-sm text-gray-600 font-medium">Layer 3 &mdash; Evidence Photo + Description <span className="text-blue-500 text-xs">(click to see evidence)</span></span>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{viewingClaim.proof_description ? "Submitted" : "Not Submitted"}</span>
                </button>
                <button
                  onClick={() => setComparingClaim(viewingClaim)}
                  className="w-full flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-200 hover:bg-blue-50 transition rounded-lg px-2 -mx-2 text-left"
                >
                  <span className="text-sm text-gray-600 font-medium">Layer 4 &mdash; AI Similarity Score <span className="text-blue-500 text-xs">(click to compare)</span></span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    viewingClaim.match?.confidence_score != null
                      ? viewingClaim.match.confidence_score >= 80
                        ? "bg-green-50 text-green-700"
                        : viewingClaim.match.confidence_score >= 60
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-red-50 text-red-600"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {viewingClaim.match?.confidence_score != null ? `${viewingClaim.match.confidence_score}%` : "Pending AI"}
                  </span>
                </button>
                <div className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm text-gray-600 font-medium">Layer 5 &mdash; Secret Questions</span>
                  {(() => {
                    const score = questionScore(viewingClaim.ownership_questions || []);
                    if (viewingClaim.verification_skipped) {
                      return <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg" title={viewingClaim.verification_skip_reason || ""}>Skipped &mdash; No Distinguishing Features</span>;
                    }
                    if (viewingClaim.ownership_questions?.length === 0) {
                      return <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">No Questions Generated</span>;
                    }
                    if (!score) {
                      return <span className="text-xs font-bold bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg">Awaiting Student Answers</span>;
                    }
                    return (
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        score.correct >= 2 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                      }`}>
                        {score.correct}/{score.total} Correct
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {viewingClaim.verification_skipped && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
                <p className="text-xs font-bold text-blue-400 uppercase mb-1">Verification Questions Skipped</p>
                <p className="text-blue-700 text-sm">{viewingClaim.verification_skip_reason || "This item had no distinguishing features to base questions on."} The decision relies on the AI similarity score, photo, and description alone.</p>
              </div>
            )}

            {viewingClaim.ownership_questions && viewingClaim.ownership_questions.length > 0 && (
              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Secret Question Details</p>
                <div className="space-y-3">
                  {viewingClaim.ownership_questions.map((q, idx) => {
                    const options: Record<string, string> = {
                      a: q.option_a,
                      b: q.option_b,
                      c: q.option_c,
                      d: q.option_d,
                    };
                    const isCorrect = q.student_answer === q.correct_option;
                    return (
                      <div key={q.id} className="bg-white rounded-xl p-3 border border-gray-100">
                        <p className="font-bold text-gray-700 text-sm mb-2">Q{idx + 1}. {q.question_text}</p>
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-gray-400">Correct answer:</span>
                          <span className="font-bold text-green-600">{options[q.correct_option]}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs mt-1">
                          <span className="text-gray-400">Student answered:</span>
                          {q.student_answer ? (
                            <span className={`font-bold ${isCorrect ? "text-green-600" : "text-red-500"}`}>
                              {options[q.student_answer]} {isCorrect ? "✓" : "✗"}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Not answered yet</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewingClaim.proof_description && (
              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Claimant&apos;s Written Description</p>
                <p className="text-gray-700 text-sm">{viewingClaim.proof_description}</p>
              </div>
            )}

            {viewingClaim.proof_photo_url && (
              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Claimant&apos;s Evidence Photo</p>
                <img src={viewingClaim.proof_photo_url} alt="Proof" className="w-full max-h-48 object-contain rounded-xl" />
              </div>
            )}

            {viewingClaim.admin_notes && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-4">
                <p className="text-xs font-bold text-red-400 uppercase mb-1">Admin Notes (Rejection Reason)</p>
                <p className="text-red-700 text-sm">{viewingClaim.admin_notes}</p>
              </div>
            )}

            {viewingClaim.collected_at && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
                <p className="text-xs font-bold text-blue-400 uppercase mb-1">Item Collected</p>
                <p className="text-blue-700 text-sm">Picked up on {new Date(viewingClaim.collected_at).toLocaleString()}</p>
              </div>
            )}

            {viewingClaim.claim_status === "pending" && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setRejectingClaim(viewingClaim); }}
                  disabled={actionLoading}
                  className="flex-1 border-2 border-red-200 text-red-500 hover:bg-red-500 hover:text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
                >
                  Reject Claim
                </button>
                <button
                  onClick={() => handleApprove(viewingClaim)}
                  disabled={actionLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Approve Claim"}
                </button>
              </div>
            )}

            {viewingClaim.claim_status === "approved" && !viewingClaim.collected_at && (
              <button
                onClick={() => handleMarkCollected(viewingClaim)}
                disabled={actionLoading}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Mark as Collected"}
              </button>
            )}

            {(viewingClaim.claim_status === "rejected" ||
              viewingClaim.claim_status === "abandoned" ||
              (viewingClaim.claim_status === "approved" && viewingClaim.collected_at)) && (
              <button onClick={() => setViewingClaim(null)} className="w-full mt-6 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-2xl transition">Close</button>
            )}
          </div>
        </div>
      )}

      {/* Claimant's evidence */}
      {viewingEvidence && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setViewingEvidence(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition text-xl font-bold leading-none z-10"
            >
              &times;
            </button>

            <h2 className="text-xl font-black text-[#1a237e] mb-1">Claimant&apos;s Evidence</h2>
            <p className="text-gray-400 text-sm mb-6">What the student submitted to prove ownership of their reported lost item</p>

            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Original Lost Report</p>
              <div className="flex items-center gap-4">
                {viewingEvidence.match?.lost_report?.photo_url && (
                  <img src={viewingEvidence.match.lost_report.photo_url} alt="Lost item" className="w-16 h-16 object-contain rounded-xl flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-black text-gray-700 text-sm">{viewingEvidence.match?.lost_report?.item_name || "—"}</p>
                  <p className="text-gray-400 text-xs mt-1">Lost at: {viewingEvidence.match?.lost_report?.location_lost}</p>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-gray-400 uppercase mb-2">
              Claim Evidence Photos
              {viewingEvidence.proof_photo_urls && viewingEvidence.proof_photo_urls.length > 1 && (
                <span className="text-gray-400 font-normal normal-case ml-1">({viewingEvidence.proof_photo_urls.length} photos)</span>
              )}
            </p>
            {viewingEvidence.proof_photo_urls && viewingEvidence.proof_photo_urls.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {viewingEvidence.proof_photo_urls.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Claim evidence ${idx + 1}`}
                    className="w-full max-h-[60vh] object-contain rounded-2xl border border-gray-100"
                  />
                ))}
              </div>
            ) : viewingEvidence.proof_photo_url ? (
              <img src={viewingEvidence.proof_photo_url} alt="Claim evidence" className="w-full max-h-64 object-contain rounded-2xl mb-4" />
            ) : (
              <div className="w-full h-32 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 text-sm mb-4">No evidence photo submitted</div>
            )}

            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Claimant&apos;s Written Description</p>
            <p className="text-gray-700 bg-gray-50 rounded-xl p-4 text-sm leading-relaxed mb-4">
              {viewingEvidence.proof_description || "No description provided."}
            </p>

            <button
              onClick={() => setViewingEvidence(null)}
              className="w-full bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      {comparingClaim && (
        <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4 py-8 overflow-y-auto">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl p-6 sm:p-8 my-auto">
            <button
              onClick={() => setComparingClaim(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition text-xl font-bold leading-none z-10"
            >
              &times;
            </button>

            <h2 className="text-xl font-black text-[#1a237e] mb-1">Side-by-Side Comparison</h2>
            <p className="text-gray-400 text-sm mb-6">Full details of the lost report and found item being compared by AI</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs font-bold text-red-500 uppercase mb-2">Report Lost</p>
                <div className="w-full rounded-2xl overflow-hidden bg-gray-100 mb-3 flex items-center justify-center">
                  {comparingClaim.match?.lost_report?.photo_url ? (
                  <img src={comparingClaim.match.lost_report.photo_url} alt="Lost report" className="w-full max-h-[50vh] object-contain" />
                  ) : (
                  <div className="w-full h-40 flex items-center justify-center text-gray-400 text-xs">No Photo</div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    ["Item Name", comparingClaim.match?.lost_report?.item_name],
                    ["Category", comparingClaim.match?.lost_report?.category],
                    ["Location", comparingClaim.match?.lost_report?.location_lost],
                    ["Date Lost", comparingClaim.match?.lost_report?.date_lost],
                    ["Approx. Time", comparingClaim.match?.lost_report?.approx_time],
                    ["Primary Color(s)", comparingClaim.match?.lost_report?.primary_color],
                    ["Brand & Model", comparingClaim.match?.lost_report?.brand_model],
                    ["AI Similarity Score", comparingClaim.match?.confidence_score != null ? `${comparingClaim.match.confidence_score}%` : null],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between gap-2">
                      <span className="text-gray-400 font-medium">{label}</span>
                      <span className="font-bold text-gray-700 text-right">{value || "—"}</span>
                    </div>
                  ))}
                  <div>
                    <span className="text-gray-400 font-medium block mb-1">Description</span>
                    <p className="text-gray-700 bg-gray-50 rounded-xl p-3 text-xs leading-relaxed">
                      {comparingClaim.match?.lost_report?.ai_description || comparingClaim.match?.lost_report?.description || "No description provided."}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-green-600 uppercase mb-2">Report Found</p>
                <div className="w-full rounded-2xl overflow-hidden bg-gray-100 mb-3 flex items-center justify-center">
                  {comparingClaim.match?.found_record?.photo_url ? (
                    <img src={comparingClaim.match.found_record.photo_url} alt="Found item" className="w-full max-h-[50vh] object-contain" />
                  ) : (
                  <div className="w-full h-40 flex items-center justify-center text-gray-400 text-xs">No Photo</div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    ["Item Name", comparingClaim.match?.found_record?.item_name],
                    ["Category", comparingClaim.match?.found_record?.category],
                    ["Location", comparingClaim.match?.found_record?.location_found],
                    ["Date Found", comparingClaim.match?.found_record?.date_found],
                    ["Approx. Time", comparingClaim.match?.found_record?.approx_time],
                    ["Primary Color(s)", comparingClaim.match?.found_record?.primary_color],
                    ["Brand & Model", comparingClaim.match?.found_record?.brand_model],
                    ["AI Similarity Score", comparingClaim.match?.confidence_score != null ? `${comparingClaim.match.confidence_score}%` : null],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between gap-2">
                      <span className="text-gray-400 font-medium">{label}</span>
                      <span className="font-bold text-gray-700 text-right">{value || "—"}</span>
                    </div>
                  ))}
                  <div>
                    <span className="text-gray-400 font-medium block mb-1">Description</span>
                    <p className="text-gray-700 bg-gray-50 rounded-xl p-3 text-xs leading-relaxed">
                      {comparingClaim.match?.found_record?.ai_description || comparingClaim.match?.found_record?.description || "No description provided."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {(() => {
              const rawAttrs = comparingClaim.match?.attributes;
              const attrs = typeof rawAttrs === "string" ? JSON.parse(rawAttrs) : rawAttrs;
              if (!attrs) return null;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: "Description", value: attrs.description_score },
                    { label: "Photo", value: attrs.photo_score },
                    { label: "Category", value: attrs.category_score },
                    { label: "Date", value: attrs.date_score },
                    { label: "Location", value: attrs.location_score },
                  ].map((field) => (
                    <div key={field.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                      <p className="text-gray-400 text-[10px] font-bold uppercase mb-1">{field.label}</p>
                      <p className={`text-lg font-black ${
                        field.value == null ? "text-gray-300" :
                        field.value >= 80 ? "text-green-600" :
                        field.value >= 50 ? "text-yellow-600" : "text-red-500"
                      }`}>
                        {field.value != null ? `${field.value}%` : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className={`text-center rounded-2xl p-5 ${
              comparingClaim.match?.confidence_score != null
                ? comparingClaim.match.confidence_score >= 80
                  ? "bg-green-50 border border-green-100"
                  : comparingClaim.match.confidence_score >= 60
                  ? "bg-yellow-50 border border-yellow-100"
                  : "bg-red-50 border border-red-100"
                : "bg-gray-50 border border-gray-100"
            }`}>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">AI Similarity Score</p>
              <p className={`text-3xl font-black ${
                comparingClaim.match?.confidence_score != null
                  ? comparingClaim.match.confidence_score >= 80
                    ? "text-green-700"
                    : comparingClaim.match.confidence_score >= 60
                    ? "text-yellow-700"
                    : "text-red-600"
                  : "text-gray-400"
              }`}>
                {comparingClaim.match?.confidence_score != null ? `${comparingClaim.match.confidence_score}%` : "Pending AI Analysis"}
              </p>
              <p className="text-gray-400 text-xs mt-1">How closely the reported lost item matches the found item</p>
            </div>

            <button
              onClick={() => setComparingClaim(null)}
              className="w-full mt-5 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Reject claim (above the review popup) */}
      {rejectingClaim && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-[#1a237e] mb-2">Reject This Claim?</h2>
            <p className="text-gray-400 text-sm mb-4">
              This will notify {rejectingClaim.student?.name || "the student"} and decrease their trust score.
            </p>
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Reason for Rejection (Optional)</label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="e.g. Evidence photo does not match the found item..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-red-400 text-gray-700 text-sm resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setRejectingClaim(null); setRejectNotes(""); }} className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleRejectConfirm} disabled={actionLoading} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50">
                {actionLoading ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
