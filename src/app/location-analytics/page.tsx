"use client";
import { useState, useEffect } from "react";
import api, { logoutUser } from "@/lib/api";

interface Hotspot {
  area: string;
  building: string;
  type: "lost" | "found" | string;
  count: number;
}

interface TopLocation {
  area: string;
  building: string;
  lost: number;
  found: number;
  total: number;
}

type FilterType = "both" | "lost" | "found";

export default function LocationAnalytics() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("both");
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const fetchHotspots = async () => {
      try {
        const res = await api.get("/locations/hotspots");
        setHotspots(res.data.hotspots || []);
      } catch (err: any) {
        if (err.response?.status === 403) {
          setAccessDenied(true);
        } else {
          console.error("Error fetching hotspots:", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchHotspots();
  }, []);

  const filtered = hotspots.filter((h) => {
    if (filter === "both") return true;
    return h.type === filter;
  });

  const topLocations: TopLocation[] = Object.values(
    hotspots.reduce((acc: Record<string, TopLocation>, h) => {
      const key = `${h.area}__${h.building}`;
      if (!acc[key]) {
        acc[key] = { area: h.area, building: h.building, lost: 0, found: 0, total: 0 };
      }
      if (h.type === "lost") acc[key].lost += h.count;
      if (h.type === "found") acc[key].found += h.count;
      acc[key].total += h.count;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total).slice(0, 5);

  const totalReports = hotspots.reduce((sum, h) => sum + h.count, 0);
  const highRiskAreas = topLocations.filter((l) => l.total >= 10).length;
  const mostActiveArea = topLocations[0]?.area || "—";

  function riskLabel(total: number) {
    if (total >= 30) return { badge: "bg-red-50 text-red-600", label: "High Risk" };
    if (total >= 15) return { badge: "bg-yellow-50 text-yellow-700", label: "Medium" };
    return { badge: "bg-green-50 text-green-700", label: "Low Risk" };
  }

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
          <a href="/location-analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 text-white font-semibold border border-white/20">
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
              Your account does not have permission to view Location Analytics. Contact the Super Admin if you believe this is a mistake.
            </p>
          </div>
        </div>
      ) : (
      <main className="flex-1 ml-72 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-[#1a237e]">Location Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">Visual heatmap showing where items are most frequently reported</p>
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

        <div className="grid grid-cols-3 gap-6 mb-8">
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
            <p className="text-2xl font-black text-[#ffd700] mt-1 truncate">{mostActiveArea}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-black text-gray-700">Campus Hotspot Map</h2>
              <p className="text-gray-400 text-xs mt-0.5">SJDM Cornerstone College Inc. Grounds</p>
            </div>

            <div className="flex items-center justify-center bg-gray-50 m-6 rounded-2xl" style={{ minHeight: 300 }}>
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
                    {filtered.length} hotspot{filtered.length !== 1 ? "s" : ""} recorded across {topLocations.length} area{topLocations.length !== 1 ? "s" : ""}.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 pb-4 flex items-center gap-4">
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

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-black text-gray-700">Top Locations</h2>
              <p className="text-gray-400 text-xs mt-0.5">Most reported areas on campus</p>
            </div>

            {loading ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : topLocations.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                <p className="font-bold">No location data yet</p>
                <p className="text-xs mt-1">Logs will appear as reports are submitted</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {topLocations.map((loc, index) => {
                  const risk = riskLabel(loc.total);
                  return (
                    <div key={index} className="px-6 py-4 flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0 ${
                        index === 0 ? "bg-red-500" : index === 1 ? "bg-orange-400" : index === 2 ? "bg-yellow-400" : "bg-gray-300"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-700 text-sm truncate">{loc.area}</p>
                        <p className="text-gray-400 text-xs truncate">{loc.building}</p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-red-500 text-xs font-semibold">Lost: {loc.lost}</span>
                          <span className="text-green-600 text-xs font-semibold">Found: {loc.found}</span>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${risk.badge}`}>
                        {risk.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      )}
    </div>
  );
}