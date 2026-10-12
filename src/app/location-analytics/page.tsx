"use client";
// Admin > Location Analytics (/location-analytics). Where items are most often reported lost and found.
// API: GET /locations/top-locations (refreshes automatically)
import { useState, useEffect } from "react";
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

type FilterType = "both" | "lost" | "found";

const EMPTY_GROUP: TopGroup = { total: 0, top: [] };

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

function LocationAnalyticsContent() {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("both");
  const [accessDenied, setAccessDenied] = useState(false);
  const [topLost, setTopLost] = useState<TopGroup>(EMPTY_GROUP);
  const [topFound, setTopFound] = useState<TopGroup>(EMPTY_GROUP);

  // Loads the Top 3 lost and found locations
  const fetchAll = async () => {
    try {
      const res = await api.get("/locations/top-locations");
      setTopLost(res.data.lost || EMPTY_GROUP);
      setTopFound(res.data.found || EMPTY_GROUP);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
      } else {
        console.error("Error fetching location statistics:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useAutoRefresh(fetchAll);

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
          <h1 className="text-3xl font-black text-[#1a237e]">Location Analytics</h1>
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
          <p className="text-gray-400 text-sm font-medium">High Risk Areas</p>
          <p className="text-4xl font-black text-red-500 mt-1">{highRiskAreas}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm font-medium">Most Active Area</p>
          <p className="text-2xl font-black text-[#ffd700] mt-1 truncate" title={mostActiveArea}>{mostActiveArea}</p>
        </div>
      </div>

      {/* Map card (2/3) + Top locations (1/3); stacked below xl */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 xl:gap-6">
        <div className="xl:col-span-2 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="font-black text-gray-700">Campus Hotspot Map</h2>
            <p className="text-gray-400 text-xs mt-0.5">SJDM Cornerstone College Inc. Grounds</p>
          </div>

          <div className="flex items-center justify-center bg-gray-50 m-4 sm:m-6 rounded-2xl min-h-[14rem] sm:min-h-[18rem]">
            {loading ? (
              <p className="text-gray-400 text-sm">Loading map data...</p>
            ) : totalReports === 0 ? (
              <div className="text-center p-8">
                <p className="text-gray-400 font-bold text-lg">No location data yet</p>
                <p className="text-gray-400 text-sm mt-1">Location logs will appear here as reports are submitted</p>
              </div>
            ) : (
              <div className="text-center p-8">
                <p className="text-gray-500 font-bold">Campus Map</p>
                <p className="text-gray-400 text-sm mt-2">School campus image will be integrated here once available.</p>
                <p className="text-gray-400 text-xs mt-1">
                  {totalReports} report{totalReports !== 1 ? "s" : ""} on record.
                </p>
              </div>
            )}
          </div>

          <div className="px-6 pb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-xs text-gray-500 font-medium">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded-full" />
              <span className="text-xs text-gray-500 font-medium">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-xs text-gray-500 font-medium">Low</span>
            </div>
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