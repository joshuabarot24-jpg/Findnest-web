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

interface DayPoint { key: string; label: string; found: number; lost: number; pending: number; }

const SERIES = [
  { key: "found", label: "Found Items", color: "#3b82f6" },
  { key: "lost", label: "Lost Items", color: "#ef4444" },
  { key: "pending", label: "Pending Claims", color: "#facc15" },
] as const;

// Smooth curve through the points (Catmull-Rom converted to Bezier), kept inside the chart area
function smoothPath(pts: { x: number; y: number }[], top: number, bottom: number) {
  if (pts.length < 2) return "";
  const clampY = (y: number) => Math.min(bottom, Math.max(top, y));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Dual-line (three-series) area chart over the last 7 days
function ActivityChart({ data }: { data: DayPoint[] }) {
  if (data.length < 2) return <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data yet</div>;

  const W = 700, H = 130, padX = 28, top = 10, bottom = H - 26;
  const yMax = Math.max(4, ...data.flatMap((d) => [d.found, d.lost, d.pending]));
  const stepX = (W - padX * 2) / (data.length - 1);
  const xOf = (i: number) => padX + i * stepX;
  const yOf = (v: number) => bottom - (v / yMax) * (bottom - top);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Activity over the last 7 days">
      <defs>
        {SERIES.map((s) => (
          <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = bottom - f * (bottom - top);
        return (
          <g key={f}>
            <line x1={padX} x2={W - padX} y1={y} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={0} y={y + 3} fontSize="10" fill="#9ca3af">{Math.round(f * yMax)}</text>
          </g>
        );
      })}

      {SERIES.map((s) => {
        const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d[s.key]) }));
        const line = smoothPath(pts, top, bottom);
        const area = `${line} L ${pts[pts.length - 1].x} ${bottom} L ${pts[0].x} ${bottom} Z`;
        return (
          <g key={s.key}>
            <path d={area} fill={`url(#grad-${s.key})`} />
            <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="white" stroke={s.color} strokeWidth="2">
                <title>{`${data[i].label}: ${data[i][s.key]} ${s.label.toLowerCase()}`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      {data.map((d, i) => (
        <text key={d.key} x={xOf(i)} y={H - 8} fontSize="11" textAnchor="middle" fill="#9ca3af">{d.label}</text>
      ))}
    </svg>
  );
}

// Minimalist donut: orange-to-pink ring showing pending claims as a share of all claims
function PendingDonut({ pending, total }: { pending: number; total: number }) {
  const size = 120, stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, pending / total) : 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="pendingGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={size} y2={size}>
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        {frac > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#pendingGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * frac} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-4xl font-black text-gray-700 leading-none">{pending}</p>
        <p className="text-gray-400 text-sm font-medium mt-1">Pending</p>
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
  const [stats, setStats] = useState({ found_today: 0, lost_today: 0, pending_claims: 0, total_reports: 0, unclaimed_items: 0, total_claims: 0 });
  const [week, setWeek] = useState<DayPoint[]>([]);
  const [monitorAlert, setMonitorAlert] = useState({ unclaimed: 0, review: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<ActivityItem | null>(null);
  const [activityTypeFilter, setActivityTypeFilter] = useState<"all" | "found" | "lost">("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "10d" | "15d" | "30d">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

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

        setStats({
          found_today: foundToday,
          lost_today: lostToday,
          pending_claims: pendingClaims,
          total_reports: totalReports,
          unclaimed_items: foundItems.filter((i: any) => i.status === "unclaimed").length,
          total_claims: claims.length,
        });

        // Last 7 days (Manila time) for the Activity Trends chart
        const dayKey = (ts: number) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
        const days: DayPoint[] = [];
        for (let i = 6; i >= 0; i--) {
          const t = Date.now() - i * 24 * 60 * 60 * 1000;
          days.push({
            key: dayKey(t),
            label: new Date(t).toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Manila" }),
            found: 0,
            lost: 0,
            pending: 0,
          });
        }
        const bump = (createdAt: string, field: "found" | "lost" | "pending") => {
          const d = days.find((x) => x.key === dayKey(new Date(createdAt).getTime()));
          if (d) d[field] += 1;
        };
        foundItems.forEach((i: any) => i.created_at && bump(i.created_at, "found"));
        lostItems.forEach((i: any) => i.created_at && bump(i.created_at, "lost"));
        claims.forEach((c: any) => c.claim_status === "pending" && c.created_at && bump(c.created_at, "pending"));
        setWeek(days);
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

    // Type filter first, then search by item name or who reported it
  const byType = activityTypeFilter === "all"
    ? recentActivity
    : recentActivity.filter((a) => a.type === activityTypeFilter);
  const q = search.toLowerCase().trim();
  const bySearch = q
    ? byType.filter((a) => a.item.toLowerCase().includes(q) || a.reported_by.toLowerCase().includes(q))
    : byType;

  // [Filter] Date range, in Manila time. "Today" = since midnight in Manila;
  // 7d / 30d = that many days back from now.
  const manilaDay = (ts: number) =>
    new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const todayKey = manilaDay(Date.now());
    const byDate = bySearch.filter((a) => {
    if (dateRange === "all") return true;
    if (dateRange === "today") return manilaDay(a.ts) === todayKey;
    const days = { "7d": 7, "10d": 10, "15d": 15, "30d": 30 }[dateRange];
    return a.ts >= Date.now() - days * 24 * 60 * 60 * 1000;
  });
  // [Sort] Newest first (default) or oldest first, by the real timestamp
  const displayedActivity = [...byDate].sort((a, b) => (sortOrder === "newest" ? b.ts - a.ts : a.ts - b.ts));
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
        <h1 className="text-3xl font-black text-[#06321C]">Admin Dashboard</h1>
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

      {/* Daily & Total Activity: trends chart (2/3) + pending claims ring (1/3); stacked below xl */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 xl:gap-6 mb-8">
        <div className="xl:col-span-2 min-w-0 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-black text-gray-700 text-lg mb-4">Activity Trends</h2>

          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-start gap-8">
              <div>
                <p className="text-gray-400 text-sm font-medium">Total Reports</p>
                <p className="text-4xl font-black text-[#1a237e] leading-none mt-1">{stats.total_reports}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm font-medium">Pending Claims</p>
                <p className="text-4xl font-black text-[#ffd700] leading-none mt-1">{stats.pending_claims}</p>
              </div>
            </div>

            <div className="space-y-2">
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-xs font-semibold text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <ActivityChart data={week} />
        </div>

        <div className="min-w-0 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <h2 className="font-black text-gray-700 text-lg">Pending Claims</h2>
          <div className="flex-1 flex items-center justify-center py-3">
            <PendingDonut pending={stats.pending_claims} total={stats.total_claims} />
          </div>
          <Link href="/item-management" className="text-center text-sm font-bold text-[#1a237e] hover:underline">
            {stats.unclaimed_items} unclaimed
          </Link>
        </div>
      </div>

      {/* Recent activity: 5 rows per page */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
          <div>
            <h2 className="font-black text-gray-700">Recent Activity</h2>
            <p className="text-gray-400 text-xs">Latest lost and found reports</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={activityTypeFilter}
              onChange={(e) => { setActivityTypeFilter(e.target.value as "all" | "found" | "lost"); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
            >
              <option value="all">All</option>
              <option value="found">Found Only</option>
              <option value="lost">Lost Only</option>
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
            <select
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value as typeof sortOrder); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <input
              type="text"
              placeholder="Search item or reporter..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm w-full sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-gray-400 text-sm">Loading recent activity...</div>
        ) : displayedActivity.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-400 text-sm">
            {recentActivity.length === 0 ? "No recent activity yet." : "No matching activity."}
          </div>
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
                              <img src={activity.photo_url} alt={activity.item} className="w-full h-full object-contain" />
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
          className="fixed inset-0 z-[160] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md cursor-zoom-out px-4"
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

            <div className="w-full rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center mb-4">
              {previewItem.photo_url ? (
                <img src={previewItem.photo_url} alt={previewItem.item} className="w-full h-full object-contain" />
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
