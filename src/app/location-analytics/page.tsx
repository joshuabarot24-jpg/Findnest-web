"use client";
// Admin > Location Analytics (/location-analytics). Where items are most often reported lost and found.
// API: GET /locations/top-locations and GET /locations/activity, with year, month, range and custom dates
import { useState, useEffect, useMemo, useRef } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import AdminLayout from "@/components/AdminLayout";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

interface TopEntry {
  location: string;
  count: number;
  percent: number;
}

interface TopGroup {
  total: number;
  top: TopEntry[];
}

interface ActivityRow {
  location: string;
  lost: number;
  found: number;
}

type FilterType = "both" | "lost" | "found";
type RangeType = "all" | "week" | "month" | "custom";

const EMPTY_GROUP: TopGroup = { total: 0, top: [] };
const LOST_COLOR = "#DC2626";
const FOUND_COLOR = "#0D5C3A";
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const START_YEAR = 2025;
const MIN_DATE = `${START_YEAR}-01-01`;

const selectCls =
  "px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4ADE80] text-gray-700 text-xs font-semibold bg-white";

export default function LocationAnalytics() {
  return (
    <AuthGate allowedRole="admin">
      <LocationAnalyticsContent />
    </AuthGate>
  );
}

// One ranked list (Top 3) with a percentage bar per location
function TopList({ title, tone, group, emptyText }: { title: string; tone: "red" | "green"; group: TopGroup; emptyText: string }) {
  const rankColors = ["bg-red-500", "bg-orange-400", "bg-yellow-400"];
  const barColor = tone === "red" ? "bg-red-400" : "bg-green-500";

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="font-black text-gray-700 text-sm">{title}</p>
        <span className="text-gray-400 text-xs whitespace-nowrap">{group.total} report{group.total !== 1 ? "s" : ""}</span>
      </div>

      {group.top.length === 0 ? (
        <p className="text-gray-400 text-xs">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {group.top.map((entry, index) => (
            <div key={entry.location} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0 ${rankColors[index] || "bg-gray-300"}`}>
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-gray-700 text-sm truncate" title={entry.location}>{entry.location}</p>
                  <span className="font-black text-gray-700 text-sm flex-shrink-0">{entry.percent}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${entry.percent}%` }} />
                </div>
                <p className="text-gray-400 text-[11px] mt-1">{entry.count} report{entry.count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Grouped vertical bars: lost (red) and found (green) per location. Bars grow from zero when drawn flips to true
function ActivityChart({
  rows,
  showLost,
  showFound,
  drawn,
}: {
  rows: ActivityRow[];
  showLost: boolean;
  showFound: boolean;
  drawn: boolean;
}) {
  const maxVal = Math.max(1, ...rows.map((r) => Math.max(showLost ? r.lost : 0, showFound ? r.found : 0)));
  const niceMax = Math.max(4, Math.ceil(maxVal / 4) * 4);
  const ticks = [4, 3, 2, 1, 0].map((i) => (niceMax / 4) * i);
  const grow = "height 700ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div className="flex gap-2">
      <div className="relative w-8 shrink-0 h-64">
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute right-1 text-[10px] text-gray-400 -translate-y-1/2"
            style={{ top: `${(i / 4) * 100}%` }}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className="min-w-[30rem]">
          <div className="relative h-64 border-l border-b border-gray-200">
            {[1, 2, 3].map((i) => (
              <div key={i} className="absolute left-0 right-0 border-t border-dashed border-gray-100" style={{ top: `${(i / 4) * 100}%` }} />
            ))}

            <div className="absolute inset-0 flex">
              {rows.map((r) => (
                <div key={r.location} className="group relative flex-1 min-w-0 h-full flex items-end justify-center gap-1 px-1">
                  <div className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#06321C] px-3 py-2 text-xs text-white shadow-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <p className="font-bold">{r.location}</p>
                    {showLost && <p>Lost Reports: {r.lost}</p>}
                    {showFound && <p>Found Reports: {r.found}</p>}
                  </div>

                  {showLost && (
                    <div
                      className="w-3 sm:w-5 rounded-t-md"
                      style={{ height: `${drawn ? (r.lost / niceMax) * 100 : 0}%`, backgroundColor: LOST_COLOR, transition: grow }}
                    />
                  )}
                  {showFound && (
                    <div
                      className="w-3 sm:w-5 rounded-t-md"
                      style={{ height: `${drawn ? (r.found / niceMax) * 100 : 0}%`, backgroundColor: FOUND_COLOR, transition: grow }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex">
            {rows.map((r) => (
              <div key={r.location} className="flex-1 min-w-0 px-1 pt-2 text-center">
                <p className="text-[11px] text-gray-500 font-semibold truncate" title={r.location}>{r.location}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationAnalyticsContent() {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("both");
  const [accessDenied, setAccessDenied] = useState(false);
  const [topLost, setTopLost] = useState<TopGroup>(EMPTY_GROUP);
  const [topFound, setTopFound] = useState<TopGroup>(EMPTY_GROUP);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [drawn, setDrawn] = useState(false);

  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [range, setRange] = useState<RangeType>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: Math.max(1, currentYear - START_YEAR + 1) }, (_, i) => currentYear - i);
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // What the server is asked for. Year and month are used only when no range is chosen
  const params = useMemo(() => {
    const p: Record<string, string> = { type: filter };
    if (range === "custom") {
      if (startDate && endDate) {
        p.range = "custom";
        p.start_date = startDate;
        p.end_date = endDate;
      }
    } else if (range === "week" || range === "month") {
      p.range = range;
    } else {
      if (year !== "all") p.year = year;
      if (month !== "all") p.month = month;
    }
    return p;
  }, [filter, range, startDate, endDate, year, month]);

  const paramsKey = JSON.stringify(params);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const lastRowsKey = useRef("");
  const requestId = useRef(0);

  const fetchAll = async () => {
    const id = ++requestId.current;
    try {
      const [topRes, actRes] = await Promise.all([
        api.get("/locations/top-locations", { params: paramsRef.current }),
        api.get("/locations/activity", { params: paramsRef.current }),
      ]);
      if (id !== requestId.current) return; // a newer filter change already took over

      setTopLost(topRes.data.lost || EMPTY_GROUP);
      setTopFound(topRes.data.found || EMPTY_GROUP);

      const next: ActivityRow[] = actRes.data.rows || [];
      const key = JSON.stringify(next);
      if (key !== lastRowsKey.current) {
        // New data: redraw the bars from zero
        lastRowsKey.current = key;
        setRows(next);
        setDrawn(false);
        setTimeout(() => setDrawn(true), 60);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
      } else {
        console.error("Error fetching location statistics:", err);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useAutoRefresh(fetchAll);

  // Close the custom date popover when clicking outside it
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pickStart(v: string) {
    if (v && (v < MIN_DATE || v > todayStr)) {
      setStartDate("");
      setRangeError("Choose a date between January 1, 2025 and today.");
      return;
    }
    setRangeError("");
    setStartDate(v);
    if (v && endDate && endDate < v) setEndDate("");
  }

  function pickEnd(v: string) {
    if (v && (v < (startDate || MIN_DATE) || v > todayStr)) {
      setEndDate("");
      setRangeError(startDate ? "The end date must be between the start date and today." : "Choose a date between January 1, 2025 and today.");
      return;
    }
    setRangeError("");
    setEndDate(v);
  }

  function onYear(v: string) {
    setYear(v);
    setRange("all");
    setPickerOpen(false);
    if (v === "all") setMonth("all");
  }

  function onMonth(v: string) {
    setMonth(v);
    setRange("all");
    setPickerOpen(false);
    if (v !== "all" && year === "all") setYear(String(currentYear));
  }

  function onRange(v: RangeType) {
    setRange(v);
    if (v !== "all") {
      setYear("all");
      setMonth("all");
    }
    if (v !== "custom") {
      setStartDate("");
      setEndDate("");
    }
    setPickerOpen(v === "custom");
    setRangeError("");
  }

  const period = (() => {
    if (range === "custom") return startDate && endDate ? `${startDate} to ${endDate}` : "Pick a start and an end date";
    if (range === "week") return "This week";
    if (range === "month") return "This month";
    if (year !== "all" && month !== "all") return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
    if (year !== "all") return year;
    return "All time";
  })();

  const showLost = filter !== "found";
  const showFound = filter !== "lost";

  const totalReports = (showLost ? topLost.total : 0) + (showFound ? topFound.total : 0);
  const visibleTop = [
    ...(showLost ? topLost.top : []),
    ...(showFound ? topFound.top : []),
  ];
  const highRiskAreas = visibleTop.filter((l) => l.count >= 10).length;
  const mostActiveArea =
    visibleTop.length > 0 ? [...visibleTop].sort((a, b) => b.count - a.count)[0].location : "—";

  if (accessDenied) {
    return (
      <AdminLayout active="/location-analytics">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-gray-700 mb-2">Access Restricted</h1>
            <p className="text-gray-400 text-sm">
              Your account does not have permission to view Location Analytics. Contact the Super Admin if you believe this is a mistake.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active="/location-analytics">
      {/* Page header + Lost / Both / Found filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-[#06321C]">Location Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Where items are most frequently reported lost and found</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100">
          {(["lost", "both", "found"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                filter === f
                  ? "bg-[#1a237e] text-white"
                  : "text-gray-400 hover:text-[#1a237e]"
              }`}
            >
              {f === "lost" ? "Lost Only" : f === "found" ? "Found Only" : "Both"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards: 1 column on small screens, 3 from sm */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Total Reports</p>
          <p className="text-4xl font-black text-[#1a237e] mt-1">{totalReports}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Most Frequently Reported Areas</p>
          <p className="text-4xl font-black text-red-500 mt-1">{highRiskAreas}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Most Active Area</p>
          <p className="text-2xl font-black text-[#ffd700] mt-1 truncate" title={mostActiveArea}>{mostActiveArea}</p>
        </div>
      </div>

      {/* Activity chart card (2/3) + Top locations (1/3); stacked below xl */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 xl:gap-6">
        <div className="xl:col-span-2 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5 border-b border-gray-100">
            <div className="min-w-0 max-w-md">
              <h2 className="font-black text-gray-700">Campus Location Activity Breakdown</h2>
              <p className="text-gray-400 text-xs mt-0.5">
                Tracks the volume of lost and found report submissions by specific campus locations. Dynamic tracking updates automatically as new data is logged.
              </p>
            </div>

            <div ref={pickerRef} className="relative flex flex-wrap items-center gap-2">
              <select value={year} onChange={(e) => onYear(e.target.value)} className={selectCls} aria-label="Year">
                <option value="all">All Years</option>
                {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <select value={month} onChange={(e) => onMonth(e.target.value)} className={selectCls} aria-label="Month">
                <option value="all">All Months</option>
                {MONTH_NAMES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
              </select>
              <select value={range} onChange={(e) => onRange(e.target.value as RangeType)} className={selectCls} aria-label="Date range">
                <option value="all">All Time</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
              <button
                type="button"
                aria-label="Pick dates"
                onClick={() => (range !== "custom" ? onRange("custom") : setPickerOpen((o) => !o))}
                className={`w-9 h-9 flex items-center justify-center rounded-xl border transition ${
                  range === "custom" ? "border-[#0D5C3A] text-[#0D5C3A] bg-[#E8F5E9]" : "border-gray-200 text-gray-500 hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M16 2v4" />
                  <path d="M8 2v4" />
                  <path d="M3 10h18" />
                </svg>
              </button>

              {pickerOpen && range === "custom" && (
                <div className="absolute right-0 top-full mt-2 z-20 w-72 bg-white border border-gray-200 rounded-2xl shadow-lg p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Custom Range</p>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    min={MIN_DATE} max={endDate || todayStr}
                    onChange={(e) => pickStart(e.target.value)}
                    className="w-full mb-3 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-[#4ADE80]"
                  />
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">End date</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || MIN_DATE}
                    max={todayStr}
                    onChange={(e) => pickEnd(e.target.value)}
                    className="w-full mb-3 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-[#4ADE80]"
                  />
                  {rangeError && <p className="text-xs text-red-500 font-medium mb-2">{rangeError}</p>}
                  {!(startDate && endDate) && <p className="text-[11px] text-gray-400 mb-3">Choose both dates to apply the range. Dates run from January 1, 2025 up to today.</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => onRange("all")} className="flex-1 border border-gray-200 text-gray-500 text-xs font-bold py-2 rounded-xl hover:bg-gray-50 transition">
                      Clear
                    </button>
                    <button type="button" onClick={() => setPickerOpen(false)} className="flex-1 bg-[#0D5C3A] hover:bg-[#0A4A2E] text-white text-xs font-bold py-2 rounded-xl transition">
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 sm:px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-4">
                {showLost && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: LOST_COLOR }} />
                    <span className="text-xs text-gray-500 font-medium">Lost Reports</span>
                  </div>
                )}
                {showFound && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: FOUND_COLOR }} />
                    <span className="text-xs text-gray-500 font-medium">Found Reports</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">Period: <span className="font-bold text-gray-500">{period}</span></p>
            </div>

            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading location activity...</div>
            ) : rows.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-center">
                <div>
                  <p className="text-gray-400 font-bold text-lg">No reports for this period</p>
                  <p className="text-gray-400 text-sm mt-1">Try a different year, month, or date range</p>
                </div>
              </div>
            ) : (
              <ActivityChart rows={rows} showLost={showLost} showFound={showFound} drawn={drawn} />
            )}
          </div>
        </div>

        <div className="min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="font-black text-gray-700">Top Locations</h2>
            <p className="text-gray-400 text-xs mt-0.5">Most reported areas on campus</p>
          </div>
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : totalReports === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              <p className="font-bold">No location data yet</p>
              <p className="text-xs mt-1">Statistics will appear as reports are submitted</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {showLost && (
                <TopList title="Top 3 Lost Locations" tone="red" group={topLost} emptyText="No lost reports yet" />
              )}
              {showFound && (
                <TopList title="Top 3 Found Locations" tone="green" group={topFound} emptyText="No found reports yet" />
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}