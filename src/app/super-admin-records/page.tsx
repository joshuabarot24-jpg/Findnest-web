"use client";
// Super Admin > Digital Records (/super-admin-records). Audit log, per-case trail, 30-day archive.
// API: /audit-logs, /audit-logs/action-types, /case-trail, /case-trail/{id}, /claims/archive
import { useState, useEffect } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

const PAGE_SIZE = 5;

interface AuditRecord {
  id: number;
  action: string;
  target_type: string;
  target_id: number;
  details: string;
  performed_by: string;
  created_at: string;
}

interface CaseSummary {
  case_id: string;
  report_id: number;
  item_name: string;
  category: string;
  photo_url: string | null;
  status: string;
  reported_by: string | null;
  created_at: string;
}

interface CaseLogEntry {
  id: number;
  action: string;
  details: string;
  performed_by: string;
  created_at: string;
}

interface ArchiveClaim {
  id: number;
  student: { name: string; school_id: string | null } | null;
  match: {
    lostReport: { item_name: string } | null;
    foundRecord: { item_name: string } | null;
  } | null;
  admin_notes: string | null;
  collected_at: string | null;
  updated_at: string;
}

interface ArchiveUser {
  id: number;
  name: string;
  email: string;
  role: string;
  school_id: string | null;
  updated_at: string;
}

// Badge color per action type
function actionBadgeClass(action: string) {
  const a = action.toLowerCase();
  if (a.includes("approved") || a.includes("claimed") || a.includes("restored") || a.includes("created")) {
    return "bg-green-50 text-green-700";
  }
  if (a.includes("found")) return "bg-teal-50 text-teal-700";
  if (a.includes("assigned")) return "bg-purple-50 text-purple-700";
  if (a.includes("disposed")) return "bg-orange-50 text-orange-700";
  if (a.includes("revoked") || a.includes("rejected") || a.includes("deleted")) return "bg-red-50 text-red-600";
  if (a.includes("login")) return "bg-blue-50 text-blue-700";
  return "bg-gray-100 text-gray-600";
}

// Badge color per case status
function statusBadge(status: string) {
  switch (status) {
    case "Returned": return "bg-green-50 text-green-700";
    case "Claim Rejected": return "bg-red-50 text-red-700";
    case "Pending Verification": return "bg-yellow-50 text-yellow-700";
    case "Match Found": return "bg-purple-50 text-purple-700";
    default: return "bg-blue-50 text-blue-700";
  }
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

// Slices a list into pages of 5 (page number is clamped to a valid one)
function pageOf<T>(items: T[], page: number) {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safe = Math.min(page, pages);
  return { pages, safe, rows: items.slice((safe - 1) * PAGE_SIZE, safe * PAGE_SIZE) };
}

// Numbered pager used by the client-side lists (By Case and Archive)
function Pager({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-3 items-center justify-between">
      <p className="text-gray-400 text-sm">Showing {from}&ndash;{to} of {total}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
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

export default function SuperAdminRecords() {
  return (
    <AuthGate allowedRole="super_admin">
      <SuperAdminRecordsContent />
    </AuthGate>
  );
}

function SuperAdminRecordsContent() {
  const [view, setView] = useState<"activity" | "cases" | "archive">("activity");

  // All Activity (paged by the backend)
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [actionTypeFilter, setActionTypeFilter] = useState("");
  const [actionTypes, setActionTypes] = useState<string[]>([]);

  // By Case (5 per page, client-side)
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [caseSearch, setCaseSearch] = useState("");
  const [casePage, setCasePage] = useState(1);
  const [selectedCase, setSelectedCase] = useState<CaseSummary | null>(null);
  const [caseLogs, setCaseLogs] = useState<CaseLogEntry[]>([]);
  const [caseLogsLoading, setCaseLogsLoading] = useState(false);
  const [previewCase, setPreviewCase] = useState<CaseSummary | null>(null);

  // Archive (5 per page per section, client-side)
  const [archiveCompleted, setArchiveCompleted] = useState<ArchiveClaim[]>([]);
  const [archiveRejected, setArchiveRejected] = useState<ArchiveClaim[]>([]);
  const [archiveRevoked, setArchiveRevoked] = useState<ArchiveUser[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveSection, setArchiveSection] = useState<"completed" | "rejected" | "revoked">("completed");
  const [completedPage, setCompletedPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [revokedPage, setRevokedPage] = useState(1);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Loads one page of the audit log (quiet = no loading flicker on auto-refresh)
  const fetchRecords = async (pageNum: number, searchTerm: string, quiet = false) => {
    if (!quiet) setRecordsLoading(true);
    try {
      const response = await api.get("/audit-logs", {
        params: {
          page: pageNum,
          per_page: PAGE_SIZE,
          action: searchTerm || undefined,
          action_type: actionTypeFilter || undefined,
          sort: sortOrder,
        },
      });
      const data = response.data.logs;
      setRecords(data.data || []);
      setLastPage(data.last_page || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setRecordsLoading(false);
    }
  };

  const fetchActionTypes = async () => {
    try {
      const response = await api.get("/audit-logs/action-types");
      setActionTypes(response.data.action_types || []);
    } catch (err) {
      console.error("Error fetching action types:", err);
    }
  };

  // Loads the case list; keeps the selected case on quiet refresh
  const fetchCases = async (searchTerm: string, quiet = false) => {
    if (!quiet) setCasesLoading(true);
    try {
      const response = await api.get("/case-trail", { params: { search: searchTerm || undefined } });
      const result: CaseSummary[] = response.data.cases || [];
      setCases(result);
      if (quiet) {
        setSelectedCase((prev) => (prev ? result.find((c) => c.report_id === prev.report_id) ?? prev : result[0] ?? null));
      } else if (result.length > 0) setSelectedCase(result[0]);
      else setSelectedCase(null);
    } catch (err) {
      console.error("Error fetching cases:", err);
    } finally {
      setCasesLoading(false);
    }
  };

  const fetchCaseLogs = async (reportId: number, quiet = false) => {
    if (!quiet) setCaseLogsLoading(true);
    try {
      const response = await api.get(`/case-trail/${reportId}`);
      setCaseLogs(response.data.logs || []);
    } catch (err) {
      console.error("Error fetching case detail:", err);
    } finally {
      setCaseLogsLoading(false);
    }
  };

  const fetchArchive = async (quiet = false) => {
    if (!quiet) setArchiveLoading(true);
    try {
      const response = await api.get("/claims/archive");
      setArchiveCompleted(response.data.completed_transactions || []);
      setArchiveRejected(response.data.rejected_claims || []);
      setArchiveRevoked(response.data.revoked_accounts || []);
    } catch (err) {
      console.error("Error fetching archive:", err);
    } finally {
      setArchiveLoading(false);
    }
  };

  useEffect(() => {
    if (view === "activity") {
      fetchRecords(page, search);
      fetchActionTypes();
    }
  }, [view, page]);

  useEffect(() => {
    if (view !== "activity") return;
    const t = setTimeout(() => { setPage(1); fetchRecords(1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (view !== "activity") return;
    setPage(1);
    fetchRecords(1, search);
  }, [sortOrder, actionTypeFilter]);

  useEffect(() => {
    if (view === "cases") fetchCases(caseSearch);
  }, [view]);

  useEffect(() => {
    if (view !== "cases") return;
    const t = setTimeout(() => fetchCases(caseSearch), 400);
    return () => clearTimeout(t);
  }, [caseSearch]);

  useEffect(() => {
    if (selectedCase) fetchCaseLogs(selectedCase.report_id);
    else setCaseLogs([]);
  }, [selectedCase?.report_id]);

  useEffect(() => {
    if (view === "archive") fetchArchive();
  }, [view]);

  useAutoRefresh(async () => {
    if (view === "activity") {
      await fetchRecords(page, search, true);
      await fetchActionTypes();
    } else if (view === "cases") {
      await fetchCases(caseSearch, true);
      if (selectedCase) await fetchCaseLogs(selectedCase.report_id, true);
    } else if (view === "archive") {
      await fetchArchive(true);
    }
  });

  const claimedCount = records.filter((r) => r.action.toLowerCase().includes("claim")).length;
  const systemCount = records.filter((r) => r.performed_by.toLowerCase() === "system").length;
  const revokedCount = records.filter((r) => r.action.toLowerCase().includes("revoked")).length;

  // Current 5-row slice of each client-side list
  const caseView = pageOf(cases, casePage);
  const completedView = pageOf(archiveCompleted, completedPage);
  const rejectedView = pageOf(archiveRejected, rejectedPage);
  const revokedView = pageOf(archiveRevoked, revokedPage);

  return (
    <SuperAdminLayout active="/super-admin-records">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#1a237e] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div>
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#1a237e]">Digital Records</h1>
          <p className="text-gray-400 text-sm mt-1">Complete system-wide, tamper-evident audit log</p>
        </div>

        {/* View tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setView("activity")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              view === "activity" ? "bg-[#1a237e] text-white shadow-md" : "bg-white text-gray-500 border border-gray-200 hover:border-[#1a237e] hover:text-[#1a237e]"
            }`}
          >
            All Activity
          </button>
          <button
            onClick={() => setView("cases")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              view === "cases" ? "bg-[#1a237e] text-white shadow-md" : "bg-white text-gray-500 border border-gray-200 hover:border-[#1a237e] hover:text-[#1a237e]"
            }`}
          >
            By Case
          </button>
          <button
            onClick={() => setView("archive")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              view === "archive" ? "bg-gray-700 text-white shadow-md" : "bg-white text-gray-500 border border-gray-200 hover:border-[#1a237e] hover:text-[#1a237e]"
            }`}
          >
            Archive
          </button>
        </div>

        {view === "activity" ? (
          <>
            {/* Summary cards: 2 columns on small screens, 4 on xl */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-6 mb-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-gray-400 text-sm font-medium">Total Logs</p>
                <p className="text-3xl font-black text-[#1a237e] mt-1">{total}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-gray-400 text-sm font-medium">Claim Actions (this page)</p>
                <p className="text-3xl font-black text-green-600 mt-1">{claimedCount}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-gray-400 text-sm font-medium">System Events (this page)</p>
                <p className="text-3xl font-black text-gray-600 mt-1">{systemCount}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-gray-400 text-sm font-medium">Revoked (this page)</p>
                <p className="text-3xl font-black text-red-500 mt-1">{revokedCount}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
                <div>
                  <h2 className="font-black text-gray-700">System-Wide Audit Log</h2>
                  <p className="text-gray-400 text-xs">All entries are permanent and cannot be modified</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setSortOrder("oldest")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                      sortOrder === "oldest" ? "bg-[#1a237e] text-white" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#1a237e]"
                    }`}
                  >
                    Oldest Report
                  </button>
                  <button
                    onClick={() => setSortOrder("newest")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                      sortOrder === "newest" ? "bg-[#1a237e] text-white" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#1a237e]"
                    }`}
                  >
                    Newest Report
                  </button>
                  <select
                    value={actionTypeFilter}
                    onChange={(e) => setActionTypeFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
                  >
                    <option value="">All Action Types</option>
                    {actionTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm w-full sm:w-56"
                  />
                </div>
              </div>

              {recordsLoading ? (
                <div className="text-center py-16 text-gray-400 text-sm">Loading records...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[48rem]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Log ID</th>
                        <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Action Type</th>
                        <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Details</th>
                        <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Performed By</th>
                        <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {records.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <span className="font-black text-[#1a237e] text-sm">#REC-{String(record.id).padStart(3, "0")}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap inline-block ${actionBadgeClass(record.action)}`}>
                              {record.action}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-700 text-sm">{record.details}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-purple-50 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap inline-block">{record.performed_by}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-gray-400 text-sm">{formatTime(record.created_at)}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!recordsLoading && records.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <p className="font-bold text-lg">No records found</p>
                  <p className="text-sm mt-1">Try searching with a different keyword</p>
                </div>
              )}

              <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-3 items-center justify-between">
                <p className="text-gray-400 text-sm">
                  Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, total)} of {total} records
                </p>
                                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: lastPage }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === lastPage || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center gap-2">
                        {idx > 0 && p - arr[idx - 1] > 1 && <span className="text-gray-300">&hellip;</span>}
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
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                    disabled={page === lastPage}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : view === "cases" ? (
          // By Case: list (5 per page) beside the trail; stacked below xl
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 min-w-0">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-black text-gray-700 text-sm mb-3">Case List</h2>
                  <input
                    type="text"
                    placeholder="Search cases by item name..."
                    value={caseSearch}
                    onChange={(e) => { setCaseSearch(e.target.value); setCasePage(1); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                  />
                </div>

                {casesLoading ? (
                  <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading cases...</div>
                ) : cases.length === 0 ? (
                  <div className="px-5 py-16 text-center text-gray-400 text-sm">No lost item reports yet.</div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-50">
                      {caseView.rows.map((c) => (
                        <div
                          key={c.report_id}
                          className={`w-full flex items-center gap-3 px-5 py-4 transition ${
                            selectedCase?.report_id === c.report_id ? "bg-blue-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <button
                            onClick={() => setSelectedCase(c)}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            <div className="w-10 h-10 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                              {c.photo_url ? (
                                <img src={c.photo_url} alt={c.item_name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">No Photo</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-700 text-sm truncate">{c.item_name}</p>
                              <p className="text-gray-400 text-xs mt-0.5">{c.case_id}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${statusBadge(c.status)}`}>
                                {c.status}
                              </span>
                            </div>
                          </button>
                          <button
                            onClick={() => setPreviewCase(c)}
                            className="text-gray-300 hover:text-[#1a237e] transition flex-shrink-0 p-1"
                            title="View full details"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <Pager page={caseView.safe} pages={caseView.pages} total={cases.length} onChange={setCasePage} />
                  </>
                )}
              </div>
            </div>

            <div className="xl:col-span-2 min-w-0">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {selectedCase ? (
                  <>
                    <div className="bg-gradient-to-r from-[#1a237e] to-[#1565c0] px-6 py-5 flex flex-wrap items-center gap-4">
                      <button
                        onClick={() => setPreviewCase(selectedCase)}
                        className="w-14 h-14 bg-white/15 rounded-2xl overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-white/50 transition cursor-zoom-in"
                      >
                        {selectedCase.photo_url ? (
                          <img src={selectedCase.photo_url} alt={selectedCase.item_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/60 text-[10px] font-bold text-center px-1">No Photo</div>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-black text-xl">{selectedCase.item_name}</p>
                        <p className="text-blue-200 text-sm">{selectedCase.category} &middot; {selectedCase.case_id}</p>
                        {selectedCase.reported_by && (
                          <p className="text-blue-200 text-xs mt-0.5">Reported by {selectedCase.reported_by}</p>
                        )}
                      </div>
                      <span className={`text-xs font-bold px-4 py-2 rounded-full ${statusBadge(selectedCase.status)}`}>
                        {selectedCase.status}
                      </span>
                    </div>

                    <div className="p-6">
                      <p className="font-black text-gray-700 text-sm mb-6">
                        Chronological Case Trail &mdash; {caseLogs.length} recorded actions
                      </p>

                      {caseLogsLoading ? (
                        <div className="text-center py-16 text-gray-400 text-sm">Loading trail...</div>
                      ) : caseLogs.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 text-sm">No recorded actions yet for this case.</div>
                      ) : (
                        <div className="relative">
                          {caseLogs.map((entry, index) => {
                            const isLast = index === caseLogs.length - 1;
                            return (
                              <div key={entry.id} className="flex gap-4 relative">
                                {!isLast && <div className="absolute left-[7px] top-6 w-0.5 h-full bg-gray-200" />}
                                <div className="w-4 h-4 rounded-full flex-shrink-0 z-10 mt-1.5 bg-[#1a237e]" />
                                <div className={`flex-1 min-w-0 ${isLast ? "pb-2" : "pb-8"}`}>
                                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                      <span className="text-xs font-bold px-2 py-1 rounded-lg bg-white text-gray-700 border border-gray-200">
                                        {entry.action}
                                      </span>
                                      <span className="text-xs font-mono text-gray-400">{formatTime(entry.created_at)}</span>
                                    </div>
                                    <p className="text-gray-700 text-sm">{entry.details}</p>
                                    <p className="text-gray-400 text-xs mt-2">By: {entry.performed_by}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-24 text-gray-400 text-sm">Select a case from the list to view its full trail.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Archive: three sections, 5 rows per page each
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-black text-gray-700">Archive</h2>
              <p className="text-gray-400 text-xs">Completed and closed records from the last 30 days &mdash; nothing is ever deleted, older entries simply roll off this view</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-6 pt-5">
              <button
                onClick={() => setArchiveSection("completed")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  archiveSection === "completed" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-500 hover:text-gray-700"
                }`}
              >
                Completed Transactions ({archiveCompleted.length})
              </button>
              <button
                onClick={() => setArchiveSection("rejected")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  archiveSection === "rejected" ? "bg-red-500 text-white" : "bg-gray-50 text-gray-500 hover:text-gray-700"
                }`}
              >
                Rejected Claims ({archiveRejected.length})
              </button>
              <button
                onClick={() => setArchiveSection("revoked")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  archiveSection === "revoked" ? "bg-gray-700 text-white" : "bg-gray-50 text-gray-500 hover:text-gray-700"
                }`}
              >
                Revoked Accounts ({archiveRevoked.length})
              </button>
            </div>

            {archiveLoading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Loading archive...</div>
            ) : archiveSection === "completed" ? (
              archiveCompleted.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm mt-4">No completed transactions in the last 30 days.</div>
              ) : (
                <>
                  <div className="divide-y divide-gray-50 mt-4">
                    {completedView.rows.map((c) => {
                      const itemName = c.match?.foundRecord?.item_name || c.match?.lostReport?.item_name || "Unknown Item";
                      return (
                        <div key={c.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-gray-700 text-sm">{itemName}</p>
                            <p className="text-gray-400 text-xs mt-0.5">{c.student?.name} &middot; {c.student?.school_id}</p>
                          </div>
                          <div className="text-right">
                            <span className="bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg">Returned</span>
                            <p className="text-gray-400 text-xs mt-1">{c.collected_at ? formatTime(c.collected_at) : "—"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Pager page={completedView.safe} pages={completedView.pages} total={archiveCompleted.length} onChange={setCompletedPage} />
                </>
              )
            ) : archiveSection === "rejected" ? (
              archiveRejected.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm mt-4">No rejected claims in the last 30 days.</div>
              ) : (
                <>
                  <div className="divide-y divide-gray-50 mt-4">
                    {rejectedView.rows.map((c) => {
                      const itemName = c.match?.foundRecord?.item_name || c.match?.lostReport?.item_name || "Unknown Item";
                      return (
                        <div key={c.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-gray-700 text-sm">{itemName}</p>
                            <p className="text-gray-400 text-xs mt-0.5">{c.student?.name} &middot; {c.student?.school_id}</p>
                            {c.admin_notes && <p className="text-red-500 text-xs mt-1">Reason: {c.admin_notes}</p>}
                          </div>
                          <div className="text-right">
                            <span className="bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg">Rejected</span>
                            <p className="text-gray-400 text-xs mt-1">{formatTime(c.updated_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Pager page={rejectedView.safe} pages={rejectedView.pages} total={archiveRejected.length} onChange={setRejectedPage} />
                </>
              )
            ) : archiveRevoked.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm mt-4">No revoked accounts in the last 30 days.</div>
            ) : (
              <>
                <div className="divide-y divide-gray-50 mt-4">
                  {revokedView.rows.map((u) => (
                    <div key={u.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-gray-700 text-sm">{u.name}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{u.email} &middot; {u.school_id || "—"}</p>
                      </div>
                      <div className="text-right">
                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg capitalize">{u.role.replace("_", " ")}</span>
                        <p className="text-gray-400 text-xs mt-1">{formatTime(u.updated_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Pager page={revokedView.safe} pages={revokedView.pages} total={archiveRevoked.length} onChange={setRevokedPage} />
              </>
            )}
          </div>
        )}
      </div>

      {previewCase && (
        <div
          onClick={() => setPreviewCase(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm cursor-zoom-out px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 cursor-default max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => setPreviewCase(null)}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition text-xl font-bold leading-none shadow-md border border-gray-100 z-10"
            >
              &times;
            </button>

            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4">
              {previewCase.photo_url ? (
                <img src={previewCase.photo_url} alt={previewCase.item_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Photo Available</div>
              )}
            </div>

            <h3 className="font-black text-[#1a237e] text-lg">{previewCase.item_name}</h3>
            <span className={`inline-block mt-2 text-xs font-bold px-3 py-1.5 rounded-lg ${statusBadge(previewCase.status)}`}>
              {previewCase.status}
            </span>
            <p className="text-gray-400 text-sm mt-2">{previewCase.category}</p>
            {previewCase.reported_by && (
              <p className="text-gray-400 text-sm mt-1">Reported by {previewCase.reported_by}</p>
            )}
            <p className="text-gray-400 text-sm mt-1">Case ID: {previewCase.case_id}</p>
            <p className="text-gray-400 text-sm mt-1">{formatTime(previewCase.created_at)}</p>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}