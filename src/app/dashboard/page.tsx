"use client";
// Admin Dashboard (/dashboard). Today's counts, unclaimed-item alerts, recent activity.
// API: GET /lost-items, /found-items, /claims (refreshes every 20s)
import { useState, useEffect } from "react";
import api from "@/lib/api";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import AdminLayout from "@/components/AdminLayout";

const PAGE_SIZE = 5;

interface ActivityItem {
  item: string;
  status: string;
  time: string;
  ts: number;
  type: "found" | "lost";
  photo_url: string | null;
  reported_by: string;
}

// Numbered pager: shows first, last and the pages next to the current one
function Pager({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pages || Math.abs(p - page) <= 1
  );
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

export default function Dashboard() {
  return (
    <AuthGate allowedRole="admin">
      <DashboardContent />
    </AuthGate>
  );
}

function DashboardContent() {
  const [stats, setStats] = useState({ found_today: 0, lost_today: 0, pending_claims: 0, total_reports: 0 });
  const [monitorAlert, setMonitorAlert] = useState({ unclaimed: 0, review: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<ActivityItem | null>(null);
  const [activityTypeFilter, setActivityTypeFilter] = useState<"all" | "found" | "lost">("all");
  const [page, setPage] = useState(1);

  // Loads all three lists, builds today's counts, alerts and the merged activity feed
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lostRes, foundRes, claimsRes] = await Promise.allSettled([
          api.get("/lost-items"),
          api.get("/found-items"),
          api.get("/claims"),
        ]);

        const foundItems = foundRes.status === "fulfilled" ? foundRes.value.data.records || [] : [];
        const claims = claimsRes.status === "fulfilled" ? claimsRes.value.data.claims || [] : [];
        const lostItems = lostRes.status === "fulfilled" ? lostRes.value.data.reports || [] : [];

        const now = new Date();
        const isToday = (dateStr: string) => {
          const d = new Date(dateStr);
          return d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate();
        };
        const foundToday = foundItems.filter((i: any) => i.created_at && isToday(i.created_at)).length;
        const lostToday = lostItems.filter((i: any) => i.created_at && isToday(i.created_at)).length;
        const pendingClaims = claims.filter((c: any) => c.claim_status === "pending").length;
        const totalReports = foundItems.length + lostItems.length;

        setStats({ found_today: foundToday, lost_today: lostToday, pending_claims: pendingClaims, total_reports: totalReports });
        setMonitorAlert({
          unclaimed: foundItems.filter((i: any) => i.status === "unclaimed" && i.unclaimed_flagged_at && !i.needs_disposal_review).length,
          review: foundItems.filter((i: any) => i.status === "unclaimed" && i.needs_disposal_review).length,
        });

        const activity: ActivityItem[] = [
          ...foundItems.map((i: any) => ({
            item: i.item_name,
            status: "Found at " + i.location_found,
            time: new Date(i.created_at).toLocaleString(),
            ts: new Date(i.created_at).getTime(),
            type: "found" as const,
            photo_url: i.photo_url || null,
            reported_by: i.admin?.name || "Unknown Admin",
          })),
          ...lostItems.map((i: any) => ({
            item: i.item_name,
            status: "Reported Lost",
            time: new Date(i.created_at).toLocaleString(),
            ts: new Date(i.created_at).getTime(),
            type: "lost" as const,
            photo_url: i.photo_url || null,
            reported_by: i.user?.name || "Unknown Student",
          })),
        ].sort((a, b) => b.ts - a.ts);

        setRecentActivity(activity);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const refreshInterval = setInterval(() => {
      if (!document.hidden) fetchData();
    }, 20000);

    return () => clearInterval(refreshInterval);
  }, []);

  // Filter, then slice to the current page of 5
  const displayedActivity = activityTypeFilter === "all"
    ? recentActivity
    : recentActivity.filter((a) => a.type === activityTypeFilter);
  const totalPages = Math.max(1, Math.ceil(displayedActivity.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = displayedActivity.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Locks page scroll while the preview popup is open
  useEffect(() => {
    if (previewItem) {
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
  }, [previewItem]);

  return (
    <AdminLayout active="/dashboard">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[#1a237e]">Admin Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Welcome back! Here is what is happening on campus today.</p>
        {(monitorAlert.review > 0 || monitorAlert.unclaimed > 0) && (
          <div className="mt-4 space-y-2">
            {monitorAlert.review > 0 && (
              <Link href="/item-management" className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3 hover:bg-orange-100 transition">
                <span className="text-orange-700 text-sm font-bold">
                  {monitorAlert.review} item{monitorAlert.review !== 1 ? "s have" : " has"} reached the disposal threshold. Please document the disposal method.
                </span>
                <span className="text-orange-600 text-xs font-bold whitespace-nowrap">Review &rarr;</span>
              </Link>
            )}
            {monitorAlert.unclaimed > 0 && (
              <Link href="/item-management" className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-3 hover:bg-yellow-100 transition">
                <span className="text-yellow-700 text-sm font-bold">
                  {monitorAlert.unclaimed} item{monitorAlert.unclaimed !== 1 ? "s have" : " has"} been unclaimed for over 10 days.
                </span>
                <span className="text-yellow-700 text-xs font-bold whitespace-nowrap">View &rarr;</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Stat cards: 2 columns on small screens, 4 on xl */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Today</span>
          </div>
          <p className="text-4xl font-black text-[#1a237e]">{stats.found_today}</p>
          <p className="text-gray-400 text-sm mt-1">Items Found Today</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">Today</span>
          </div>
          <p className="text-4xl font-black text-red-500">{stats.lost_today}</p>
          <p className="text-gray-400 text-sm mt-1">Items Lost Today</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">Pending</span>
          </div>
          <p className="text-4xl font-black text-[#ffd700]">{stats.pending_claims}</p>
          <p className="text-gray-400 text-sm mt-1">Pending Claims</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">All Time</span>
          </div>
          <p className="text-4xl font-black text-[#1a237e]">{stats.total_reports}</p>
          <p className="text-gray-400 text-sm mt-1">Total Reports</p>
        </div>
      </div>

      {/* Recent activity: 5 rows per page */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
          <div>
            <h2 className="font-black text-gray-700">Recent Activity</h2>
            <p className="text-gray-400 text-xs">Latest lost and found reports</p>
          </div>
          <select
            value={activityTypeFilter}
            onChange={(e) => { setActivityTypeFilter(e.target.value as "all" | "found" | "lost"); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
          >
            <option value="all">All</option>
            <option value="found">Found Only</option>
            <option value="lost">Lost Only</option>
          </select>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-gray-400 text-sm">Loading recent activity...</div>
        ) : displayedActivity.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-400 text-sm">No recent activity yet.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Item</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Reported By</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pageRows.map((activity, index) => (
                    <tr key={`${activity.ts}-${index}`} onClick={() => setPreviewItem(activity)} className="hover:bg-gray-50 transition cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {activity.photo_url ? (
                              <img src={activity.photo_url} alt={activity.item} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">N/A</div>
                            )}
                          </div>
                          <p className="font-semibold text-gray-700 text-sm">{activity.item}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-purple-50 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-lg">
                          {activity.reported_by}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                          activity.type === "found" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                        }`}>
                          {activity.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-400 text-sm">{activity.time}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={safePage} pages={totalPages} total={displayedActivity.length} onChange={setPage} />
          </>
        )}
      </div>

      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-[160] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm cursor-zoom-out px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 cursor-default max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition text-xl font-bold leading-none shadow-md border border-gray-100 z-10"
            >
              &times;
            </button>

            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4">
              {previewItem.photo_url ? (
                <img src={previewItem.photo_url} alt={previewItem.item} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Photo Available</div>
              )}
            </div>

            <h3 className="font-black text-[#1a237e] text-lg">{previewItem.item}</h3>
            <span className={`inline-block mt-2 text-xs font-bold px-3 py-1.5 rounded-lg ${
              previewItem.type === "found" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}>
              {previewItem.status}
            </span>
            <p className="text-gray-400 text-sm mt-2">Reported by {previewItem.reported_by}</p>
            <p className="text-gray-400 text-sm mt-1">{previewItem.time}</p>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}