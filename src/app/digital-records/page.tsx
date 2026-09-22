"use client";
import { useState, useEffect } from "react";
import api, { logoutUser } from "@/lib/api";

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

type FilterType = "all" | "lost" | "found" | "release";

function actionBadgeClass(action: string) {
  const a = action.toLowerCase();
  if (a.includes("approved") || a.includes("claimed") || a.includes("restored") || a.includes("created") || a.includes("logged")) {
    return "bg-green-50 text-green-700";
  }
  if (a.includes("found") || a.includes("assigned") || a.includes("updated")) {
    return "bg-blue-50 text-blue-700";
  }
  if (a.includes("disposed") || a.includes("rejected") || a.includes("deleted")) {
    return "bg-red-50 text-red-600";
  }
  if (a.includes("pending")) {
    return "bg-yellow-50 text-yellow-700";
  }
  return "bg-gray-50 text-gray-600";
}

function statusBadge(status: string) {
  switch (status) {
    case "Returned": return "bg-green-50 text-green-700";
    case "Claim Rejected": return "bg-red-50 text-red-700";
    case "Pending Verification": return "bg-yellow-50 text-yellow-700";
    case "Match Found": return "bg-purple-50 text-purple-700";
    default: return "bg-blue-50 text-blue-700";
  }
}

function isAdminRelevant(action: string, targetType: string): boolean {
  const a = action.toLowerCase();
  const t = (targetType || "").toLowerCase();
  if (t.includes("found_item") || t.includes("claim") || t.includes("lost_item")) return true;
  if (
    a.includes("item") || a.includes("found") || a.includes("lost") || a.includes("claim") ||
    a.includes("approved") || a.includes("rejected") || a.includes("disposed") ||
    a.includes("unclaimed") || a.includes("surrendered") || a.includes("storage") || a.includes("logged")
  ) return true;
  return false;
}

function matchesFilter(action: string, filter: FilterType): boolean {
  if (filter === "all") return true;
  const a = action.toLowerCase();
  if (filter === "lost") return a.includes("lost item reported") || a.includes("lost item report");
  if (filter === "found") return a.includes("found item recorded") || a.includes("found item record") || a.includes("item added") || a.includes("item logged");
  if (filter === "release") return a.includes("claim approved") || a.includes("item released") || a.includes("claim approved");
  return true;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

export default function DigitalRecords() {
  const [view, setView] = useState<"activity" | "cases">("activity");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [accessDenied, setAccessDenied] = useState(false);

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [caseSearch, setCaseSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState<CaseSummary | null>(null);
  const [caseLogs, setCaseLogs] = useState<CaseLogEntry[]>([]);
  const [caseLogsLoading, setCaseLogsLoading] = useState(false);
  const [previewCase, setPreviewCase] = useState<CaseSummary | null>(null);

  const fetchRecords = async (pageNum: number) => {
    setLoading(true);
    try {
      const response = await api.get("/audit-logs", { params: { page: pageNum } });
      const data = response.data.logs;
      const allRecords: AuditRecord[] = data.data || [];
      const filtered = allRecords.filter((r) => isAdminRelevant(r.action, r.target_type));
      setRecords(filtered);
      setLastPage(data.last_page || 1);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
      } else {
        console.error("Error fetching audit logs:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async (searchTerm: string) => {
    setCasesLoading(true);
    try {
      const response = await api.get("/case-trail", { params: { search: searchTerm || undefined } });
      const result: CaseSummary[] = response.data.cases || [];
      setCases(result);
      if (result.length > 0) setSelectedCase(result[0]);
      else setSelectedCase(null);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
      } else {
        console.error("Error fetching cases:", err);
      }
    } finally {
      setCasesLoading(false);
    }
  };

  const fetchCaseLogs = async (reportId: number) => {
    setCaseLogsLoading(true);
    try {
      const response = await api.get(`/case-trail/${reportId}`);
      setCaseLogs(response.data.logs || []);
    } catch (err) {
      console.error("Error fetching case detail:", err);
    } finally {
      setCaseLogsLoading(false);
    }
  };

  useEffect(() => {
    if (view === "activity") fetchRecords(page);
  }, [view, page]);

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
  }, [selectedCase]);

  const displayed = records.filter((r) => {
    if (!matchesFilter(r.action, filterType)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.action.toLowerCase().includes(q) ||
      (r.details || "").toLowerCase().includes(q) ||
      (r.performed_by || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex">

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
          <a href="/admin-user-management" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>User Management</span>
          </a>
          <a href="/digital-records" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 text-white font-semibold border border-white/20">
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
              Your account does not have permission to view Digital Records. Contact the Super Admin if you believe this is a mistake.
            </p>
          </div>
        </div>
      ) : (
      <main className="flex-1 ml-72 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#1a237e]">Digital Records</h1>
          <p className="text-gray-400 text-sm mt-1">Audit trail for found items and claim actions handled by this admin</p>
        </div>

        <div className="flex items-center gap-2 mb-6">
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
        </div>

        {view === "activity" ? (
          <>
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setFilterType("all")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${filterType === "all" ? "bg-blue-50 text-[#1a237e] border border-blue-200" : "bg-white text-gray-400 border border-gray-200"}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("lost")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${filterType === "lost" ? "bg-red-50 text-red-600 border border-red-200" : "bg-white text-gray-400 border border-gray-200"}`}
              >
                Lost Item Report
              </button>
              <button
                onClick={() => setFilterType("found")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${filterType === "found" ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-white text-gray-400 border border-gray-200"}`}
              >
                Found Item Recorded
              </button>
              <button
                onClick={() => setFilterType("release")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${filterType === "release" ? "bg-green-50 text-green-700 border border-green-200" : "bg-white text-gray-400 border border-gray-200"}`}
              >
                Release Item
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div>
                  <h2 className="font-black text-gray-700">Item & Claim Activity Log</h2>
                  <p className="text-gray-400 text-xs">Showing found item and claim-related actions only</p>
                </div>
                <input
                  type="text"
                  placeholder="Search by action, details, or performed by..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm w-80"
                />
              </div>

              {loading ? (
                <div className="text-center py-16 text-gray-400 text-sm">Loading records...</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Log ID</th>
                      <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
                      <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Details</th>
                      <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Performed By</th>
                      <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {displayed.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <span className="font-black text-[#1a237e] text-sm">#REC-{String(record.id).padStart(3, "0")}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${actionBadgeClass(record.action)}`}>{record.action}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-700 text-sm">{record.details}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-blue-50 text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg">{record.performed_by}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-400 text-sm">{formatTime(record.created_at)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!loading && displayed.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <p className="font-bold text-lg">No records found</p>
                  <p className="text-sm mt-1">Item and claim actions will appear here as they happen</p>
                </div>
              )}

              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-gray-400 text-sm">Showing {displayed.length} relevant records &mdash; page {page} of {lastPage}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 bg-[#1a237e] rounded-lg text-white text-sm font-bold">{page}</span>
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
        ) : (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-black text-gray-700 text-sm mb-3">Case List</h2>
                  <input
                    type="text"
                    placeholder="Search cases by item name..."
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                  />
                </div>

                {casesLoading ? (
                  <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading cases...</div>
                ) : cases.length === 0 ? (
                  <div className="px-5 py-16 text-center text-gray-400 text-sm">No lost item reports yet.</div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                    {cases.map((c) => (
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
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${statusBadge(c.status)}`}>{c.status}</span>
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
                )}
              </div>
            </div>

            <div className="col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {selectedCase ? (
                  <>
                    <div className="bg-gradient-to-r from-[#1a237e] to-[#1565c0] px-6 py-5 flex items-center gap-4">
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
                      <div className="flex-1">
                        <p className="text-white font-black text-xl">{selectedCase.item_name}</p>
                        <p className="text-blue-200 text-sm">{selectedCase.category} &middot; {selectedCase.case_id}</p>
                        {selectedCase.reported_by && <p className="text-blue-200 text-xs mt-0.5">Reported by {selectedCase.reported_by}</p>}
                      </div>
                      <span className={`text-xs font-bold px-4 py-2 rounded-full ${statusBadge(selectedCase.status)}`}>{selectedCase.status}</span>
                    </div>

                    <div className="p-6">
                      <p className="font-black text-gray-700 text-sm mb-6">Chronological Case Trail &mdash; {caseLogs.length} recorded actions</p>

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
                                <div className={`flex-1 ${isLast ? "pb-2" : "pb-8"}`}>
                                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-bold px-2 py-1 rounded-lg bg-white text-gray-700 border border-gray-200">{entry.action}</span>
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
        )}
      </main>
      )}

      {previewCase && (
        <div
          onClick={() => setPreviewCase(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm cursor-zoom-out px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 cursor-default"
          >
            <button
              onClick={() => setPreviewCase(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition text-xl font-bold leading-none z-10"
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
    </div>
  );
}