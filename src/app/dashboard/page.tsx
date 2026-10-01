"use client";
import { useState, useEffect } from "react";
import api, { logoutUser } from "@/lib/api";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";

interface ActivityItem {
  item: string;
  status: string;
  time: string;
  type: "found" | "lost";
  photo_url: string | null;
  reported_by: string;
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
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [allActivityPage, setAllActivityPage] = useState(1);
  const [activityTypeFilter, setActivityTypeFilter] = useState<"all" | "found" | "lost">("all");
  const ALL_ACTIVITY_PAGE_SIZE = 20;

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

        const activity = [
          ...foundItems.map((i: any) => ({
            item: i.item_name,
            status: "Found at " + i.location_found,
            time: new Date(i.created_at).toLocaleString(),
            type: "found" as const,
            photo_url: i.photo_url || null,
            reported_by: i.admin?.name || "Unknown Admin",
          })),
          ...lostItems.map((i: any) => ({
            item: i.item_name,
            status: "Reported Lost",
            time: new Date(i.created_at).toLocaleString(),
            type: "lost" as const,
            photo_url: i.photo_url || null,
            reported_by: i.user?.name || "Unknown Student",
          })),
        ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

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

  const displayedActivity = activityTypeFilter === "all"
    ? recentActivity
    : recentActivity.filter((a) => a.type === activityTypeFilter);

  useEffect(() => {
    const anyModalOpen = !!previewItem || showAllActivity;
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
  }, [previewItem, showAllActivity]);

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex">

      <aside className="w-72 bg-[#1a237e] h-screen flex flex-col fixed left-0 top-0 bottom-0 overflow-y-auto">
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
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 text-white font-semibold border border-white/20">
            <span>Dashboard</span>
          </Link>
          <Link href="/item-management" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Item Management</span>
          </Link>
          <Link href="/claim-verification" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Claim Verification</span>
          </Link>
          <Link href="/location-analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Location Analytics</span>
          </Link>
          <Link href="/admin-user-management" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>User Management</span>
          </Link>
          <Link href="/digital-records" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Digital Records</span>
          </Link>
          <Link href="/admin-support" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Support Inbox</span>
          </Link>
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
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#1a237e]">Admin Dashboard</h1>
                    <p className="text-gray-400 text-sm mt-1">Welcome back! Here is what is happening on campus today.</p>
          {(monitorAlert.review > 0 || monitorAlert.unclaimed > 0) && (
            <div className="mt-4 space-y-2">
              {monitorAlert.review > 0 && (
                <Link href="/item-management" className="flex items-center justify-between gap-4 bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3 hover:bg-orange-100 transition">
                  <span className="text-orange-700 text-sm font-bold">
                    {monitorAlert.review} item{monitorAlert.review !== 1 ? "s have" : " has"} reached the disposal threshold. Please document the disposal method.
                  </span>
                  <span className="text-orange-600 text-xs font-bold whitespace-nowrap">Review &rarr;</span>
                </Link>
              )}
              {monitorAlert.unclaimed > 0 && (
                <Link href="/item-management" className="flex items-center justify-between gap-4 bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-3 hover:bg-yellow-100 transition">
                  <span className="text-yellow-700 text-sm font-bold">
                    {monitorAlert.unclaimed} item{monitorAlert.unclaimed !== 1 ? "s have" : " has"} been unclaimed for over 10 days.
                  </span>
                  <span className="text-yellow-700 text-xs font-bold whitespace-nowrap">View &rarr;</span>
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
            <div>
              <h2 className="font-black text-gray-700">Recent Activity</h2>
              <p className="text-gray-400 text-xs">Latest lost and found reports</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={activityTypeFilter}
                onChange={(e) => setActivityTypeFilter(e.target.value as "all" | "found" | "lost")}
                className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
              >
                <option value="all">All</option>
                <option value="found">Found Only</option>
                <option value="lost">Lost Only</option>
              </select>
              <button onClick={() => { setShowAllActivity(true); setAllActivityPage(1); }} className="text-sm font-bold text-[#1a237e] hover:underline">View All</button>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-gray-400 text-sm">Loading recent activity...</div>
          ) : displayedActivity.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-400 text-sm">No recent activity yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Item</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Reported By</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayedActivity.map((activity, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setPreviewItem(activity)}
                          className="w-9 h-9 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 hover:ring-2 hover:ring-[#1a237e] transition cursor-zoom-in"
                        >
                          {activity.photo_url ? (
                            <img src={activity.photo_url} alt={activity.item} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">N/A</div>
                          )}
                        </button>
                        <button onClick={() => setPreviewItem(activity)} className="font-semibold text-gray-700 text-sm hover:text-[#1a237e] hover:underline transition text-left">
                          {activity.item}
                        </button>
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
          )}
        </div>
      </main>

      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-[160] flex items-center justify-center bg-[#0d1757]/80 backdrop-blur-sm cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 cursor-default"
          >
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute -top-3 -right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition text-xl font-bold leading-none shadow-md border border-gray-100 z-10"
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

      {showAllActivity && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-8 max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowAllActivity(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-2xl font-black text-[#1a237e] mb-1">All Activity</h2>
            <p className="text-gray-400 text-sm mb-6">{recentActivity.length} total lost and found reports</p>

            <div className="overflow-y-auto overflow-x-auto flex-1 border border-gray-100 rounded-2xl">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Item</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Reported By</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentActivity
                    .slice((allActivityPage - 1) * ALL_ACTIVITY_PAGE_SIZE, allActivityPage * ALL_ACTIVITY_PAGE_SIZE)
                    .map((activity, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPreviewItem(activity)}
                              className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 hover:ring-2 hover:ring-[#1a237e] transition cursor-zoom-in"
                            >
                              {activity.photo_url ? (
                                <img src={activity.photo_url} alt={activity.item} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-[9px]">N/A</div>
                              )}
                            </button>
                            <button onClick={() => setPreviewItem(activity)} className="font-semibold text-gray-700 text-sm hover:text-[#1a237e] hover:underline transition text-left">
                              {activity.item}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-purple-50 text-purple-700 text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap inline-block">{activity.reported_by}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap inline-block ${activity.type === "found" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                            {activity.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-400 text-xs">{activity.time}</p>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {recentActivity.length === 0 && (
                <div className="text-center py-16 text-gray-400 text-sm">No activity yet.</div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4">
              <p className="text-gray-400 text-sm">
                Showing {recentActivity.length === 0 ? 0 : (allActivityPage - 1) * ALL_ACTIVITY_PAGE_SIZE + 1}
                &ndash;{Math.min(allActivityPage * ALL_ACTIVITY_PAGE_SIZE, recentActivity.length)} of {recentActivity.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAllActivityPage((p) => Math.max(1, p - 1))}
                  disabled={allActivityPage === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 bg-[#1a237e] rounded-lg text-white text-sm font-bold">{allActivityPage}</span>
                <button
                  onClick={() => setAllActivityPage((p) => Math.min(Math.ceil(recentActivity.length / ALL_ACTIVITY_PAGE_SIZE) || 1, p + 1))}
                  disabled={allActivityPage >= Math.ceil(recentActivity.length / ALL_ACTIVITY_PAGE_SIZE)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}