"use client";
import { useState, useEffect, useMemo } from "react";
import api, { logoutUser } from "@/lib/api";

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
  photo_similarity_score: number | null;
  competing_claims_count?: number;
  admin_notes: string | null;
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
  } | null;
  match: {
    id: number;
    confidence_score: number | null;
    match_status: string;
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

function statusStyles(status: string) {
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

function questionScore(questions: OwnershipQuestion[]) {
  const answered = questions.filter((q) => q.student_answer !== null);
  if (answered.length === 0) return null;
  const correct = answered.filter((q) => q.student_answer === q.correct_option).length;
  return { correct, total: answered.length };
}

export default function ClaimVerification() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return claims.filter(
      (c) =>
        (c.student?.name || "").toLowerCase().includes(q) ||
        (c.match?.found_record?.item_name || "").toLowerCase().includes(q) ||
        c.claim_status.toLowerCase().includes(q)
    );
  }, [claims, search]);

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
    setActionLoading(true);
    try {
      await api.post(`/claims/${claim.id}/collected`);
      setToast(`Item marked as collected by ${claim.student?.name || "student"}.`);
      setViewingClaim(null);
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
          <a href="/claim-verification" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 text-white font-semibold border border-white/20">
            <span>Claim Verification</span>
          </a>
          <a href="/location-analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Location Analytics</span>
          </a>
          <a href="/admin-user-management" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
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

      {accessDenied ? (
        <div className="flex-1 ml-72 flex items-center justify-center min-h-screen">
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
      ) : (
      <main className="flex-1 ml-72 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-[#1a237e]">Claim Verification</h1>
            <p className="text-gray-400 text-sm mt-1">Review and process student item claims through the 5-layer verification system</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="font-black text-gray-700 text-lg">All Claims</h2>
            <input
              type="text"
              placeholder="Search by student, item, or status..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm w-72"
            />
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Loading claims...</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Claimant</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Item Claimed</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">AI Score</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Submitted</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((claim) => {
                  const styles = statusStyles(claim.claim_status);
                  return (
                    <tr key={claim.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0">
                            {(claim.student?.name || "?").charAt(0).toUpperCase()}
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
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition hover:ring-2 hover:ring-offset-1 cursor-pointer ${
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
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="font-bold text-lg">No claims found</p>
              <p className="text-sm mt-1">Claims will appear here once students submit them</p>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} claims
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={p === page ? "px-3 py-1.5 bg-[#1a237e] rounded-lg text-white text-sm font-bold" : "px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition"}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        </div>
      </main>
      )}

      {viewingClaim && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 p-8 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setViewingClaim(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none">&times;</button>

            <h2 className="text-2xl font-black text-[#1a237e] mb-1">Claim Review</h2>
            <p className="text-gray-400 text-sm mb-6">Claim #{String(viewingClaim.id).padStart(4, "0")} &mdash; submitted {new Date(viewingClaim.created_at).toLocaleString()}</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Claimant</p>
                <p className="font-black text-gray-700">{viewingClaim.student?.name || "Unknown"}</p>
                <p className="text-gray-400 text-xs mt-1">{viewingClaim.student?.email}</p>
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
                  <img src={viewingClaim.match.found_record.photo_url} alt="Found item" className="w-full h-24 object-cover rounded-xl mb-2" />
                )}
                <p className="font-black text-gray-700">{viewingClaim.match?.found_record?.item_name || "—"}</p>
                <p className="text-gray-400 text-xs mt-1">{viewingClaim.match?.found_record?.category}</p>
                <p className="text-gray-400 text-xs">Found at: {viewingClaim.match?.found_record?.location_found}</p>
                <p className="text-gray-400 text-xs">Storage: {viewingClaim.match?.found_record?.storage_location || "—"}</p>
                {viewingClaim.claim_status === "pending" && (viewingClaim.competing_claims_count ?? 1) > 1 && (
                  <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-2.5">
                    <p className="text-orange-700 text-xs font-bold">
                      ⚠ {viewingClaim.competing_claims_count} students have submitted claims for this item — compare evidence carefully before deciding.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3">Original Lost Report</p>
              <div className="flex items-center gap-4">
                {viewingClaim.match?.lost_report?.photo_url && (
                  <img src={viewingClaim.match.lost_report.photo_url} alt="Lost item" className="w-20 h-20 object-cover rounded-xl flex-shrink-0" />
                )}
                <div>
                  <p className="font-black text-gray-700">{viewingClaim.match?.lost_report?.item_name || "—"}</p>
                  <p className="text-gray-400 text-xs mt-1">Lost at: {viewingClaim.match?.lost_report?.location_lost}</p>
                  <p className="text-gray-400 text-xs">Date lost: {viewingClaim.match?.lost_report?.date_lost}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3">5-Layer Verification</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600 font-medium">Layer 1 &mdash; Identity Check</span>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">Student Verified</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600 font-medium">Layer 2 &mdash; Found Item Report</span>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{viewingClaim.match ? "Match Linked" : "No Match"}</span>
                </div>
                <button
                  onClick={() => setViewingEvidence(viewingClaim)}
                  className="w-full flex items-center justify-between py-2 border-b border-gray-200 hover:bg-blue-50 transition rounded-lg px-2 -mx-2"
                >
                  <span className="text-sm text-gray-600 font-medium">Layer 3 &mdash; Evidence Photo + Description <span className="text-blue-500 text-xs">(click to see evidence)</span></span>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{viewingClaim.proof_description ? "Submitted" : "Not Submitted"}</span>
                </button>
                <button
                  onClick={() => setComparingClaim(viewingClaim)}
                  className="w-full flex items-center justify-between py-2 border-b border-gray-200 hover:bg-blue-50 transition rounded-lg px-2 -mx-2"
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
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600 font-medium">Layer 5 &mdash; Secret Questions</span>
                  {(() => {
                    const score = questionScore(viewingClaim.ownership_questions || []);
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
                <img src={viewingClaim.proof_photo_url} alt="Proof" className="w-full max-h-48 object-cover rounded-xl" />
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

      {viewingEvidence && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[85vh] overflow-y-auto">
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
                  <img src={viewingEvidence.match.lost_report.photo_url} alt="Lost item" className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                )}
                <div>
                  <p className="font-black text-gray-700 text-sm">{viewingEvidence.match?.lost_report?.item_name || "—"}</p>
                  <p className="text-gray-400 text-xs mt-1">Lost at: {viewingEvidence.match?.lost_report?.location_lost}</p>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Claim Evidence Photo</p>
            {viewingEvidence.proof_photo_url ? (
              <img src={viewingEvidence.proof_photo_url} alt="Claim evidence" className="w-full max-h-64 object-cover rounded-2xl mb-4" />
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

      {comparingClaim && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl p-8 my-auto">
            <button
              onClick={() => setComparingClaim(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition text-xl font-bold leading-none z-10"
            >
              &times;
            </button>

            <h2 className="text-xl font-black text-[#1a237e] mb-1">Side-by-Side Comparison</h2>
            <p className="text-gray-400 text-sm mb-6">Full details of the lost report and found item being compared by AI</p>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs font-bold text-red-500 uppercase mb-2">Report Lost</p>
                <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-3">
                  {comparingClaim.match?.lost_report?.photo_url ? (
                    <img src={comparingClaim.match.lost_report.photo_url} alt="Lost report" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Photo</div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Item Name</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.lost_report?.item_name || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Category</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.lost_report?.category || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Location</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.lost_report?.location_lost || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Date Lost</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.lost_report?.date_lost || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Approx. Time</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.lost_report?.approx_time || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Primary Color(s)</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.lost_report?.primary_color || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Brand & Model</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.lost_report?.brand_model || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">AI Similarity Score</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.confidence_score != null ? `${comparingClaim.match.confidence_score}%` : "—"}</span>
                  </div>
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
                <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-3">
                  {comparingClaim.match?.found_record?.photo_url ? (
                    <img src={comparingClaim.match.found_record.photo_url} alt="Found item" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Photo</div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Item Name</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.found_record?.item_name || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Category</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.found_record?.category || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Location</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.found_record?.location_found || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Date Found</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.found_record?.date_found || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Approx. Time</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.found_record?.approx_time || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Primary Color(s)</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.found_record?.primary_color || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">Brand & Model</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.found_record?.brand_model || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 font-medium">AI Similarity Score</span>
                    <span className="font-bold text-gray-700 text-right">{comparingClaim.match?.confidence_score != null ? `${comparingClaim.match.confidence_score}%` : "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium block mb-1">Description</span>
                    <p className="text-gray-700 bg-gray-50 rounded-xl p-3 text-xs leading-relaxed">
                      {comparingClaim.match?.found_record?.ai_description || comparingClaim.match?.found_record?.description || "No description provided."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

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

      {rejectingClaim && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8">
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
    </div>
  );
}