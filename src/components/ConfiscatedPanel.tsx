"use client";
import { useMemo, useState } from "react";

const PAGE_SIZE = 5;
const CATEGORY_OPTIONS = [
  "Electronics", "Personal Belongings", "ID/Cards", "Keys",
  "School Supplies", "Accessories", "Books", "Vapes", "Others",
];

type DateRange = "all" | "today" | "7d" | "10d" | "15d" | "30d";

export interface ConfiscatedItem {
  id: number;
  item_name: string;
  category: string;
  date_found: string | null;
  created_at: string;
  status: string;
  photo_url: string | null;
  student_name?: string | null;
  violation_notes?: string | null;
  approx_time?: string | null;
  admin?: { name: string } | null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const manilaDay = (ts: number) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

const selectCls =
  "px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold";

export default function ConfiscatedPanel({
  items,
  onView,
  onDelete,
}: {
  items: ConfiscatedItem[];
  onView: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const todayKey = manilaDay(Date.now());
    const standard = CATEGORY_OPTIONS.filter((c) => c !== "Others");

    const list = items.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;

      if (categoryFilter === "Others") {
        if (standard.includes(i.category)) return false;
      } else if (categoryFilter !== "all" && i.category !== categoryFilter) {
        return false;
      }

      if (dateRange !== "all") {
        const ts = new Date(i.created_at).getTime();
        if (dateRange === "today") {
          if (manilaDay(ts) !== todayKey) return false;
        } else {
          const days = { "7d": 7, "10d": 10, "15d": 15, "30d": 30 }[dateRange];
          if (ts < Date.now() - days * 24 * 60 * 60 * 1000) return false;
        }
      }

      if (!q) return true;
      return (
        i.item_name.toLowerCase().includes(q) ||
        (i.category || "").toLowerCase().includes(q) ||
        (i.student_name || "").toLowerCase().includes(q) ||
        (i.admin?.name || "").toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === "oldest" ? diff : -diff;
    });
  }, [items, search, statusFilter, categoryFilter, dateRange, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
        <div>
          <h2 className="font-black text-gray-700 text-lg">All Confiscated Items</h2>
          <p className="text-gray-400 text-xs mt-0.5">School-confiscated property. Kept apart from lost and found records.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
            <option value="all">All Statuses</option>
            <option value="confiscated">Confiscated</option>
          </select>
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className={selectCls}>
            <option value="all">All Categories</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={dateRange} onChange={(e) => { setDateRange(e.target.value as DateRange); setPage(1); }} className={selectCls}>
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="10d">Last 10 days</option>
            <option value="15d">Last 15 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as "newest" | "oldest"); setPage(1); }} className={selectCls}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, category, or student..."
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs w-56"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="font-bold text-lg">{items.length === 0 ? "No confiscated items yet" : "No matches"}</p>
          <p className="text-sm mt-1">
            {items.length === 0 ? "Items recorded under the Confiscated intake type appear here" : "Try a different search or filter"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem]">
            <thead>
              <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-6 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Date Confiscated</th>
                <th className="px-4 py-3">Confiscated By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                        {i.photo_url ? (
                          <img src={i.photo_url} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-gray-300 text-[10px] font-bold">No photo</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-700 truncate">{i.item_name}</p>
                        {i.student_name ? <p className="text-xs text-gray-400 truncate">Student: {i.student_name}</p> : null}
                        {i.violation_notes ? <p className="text-xs text-gray-400 truncate max-w-[16rem]">{i.violation_notes}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{i.category}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(i.date_found || i.created_at)}
                    {i.approx_time ? <span className="block text-xs text-gray-400">{formatTime(i.approx_time)}</span> : null}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{i.admin?.name || "-"}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                      Confiscated
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onView(i.id)}
                      className="bg-blue-50 hover:bg-[#1a237e] hover:text-white text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg transition mr-2"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onDelete(i.id)}
                      className="bg-red-50 hover:bg-red-500 hover:text-white text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-gray-400 text-xs">
            Showing {(safePage - 1) * PAGE_SIZE + 1}&ndash;{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-xs hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500 font-bold">{safePage} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-xs hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}