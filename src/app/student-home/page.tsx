"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";

interface LostReport {
  id: number;
  item_name: string;
  category: string;
  description: string | null;
  ai_description: string | null;
  location_lost: string;
  date_lost: string;
  status: string;
  photo_url: string | null;
}

interface PublicLostReport {
  id: number;
  item_name: string;
  category: string;
  location_lost: string;
  date_lost: string;
  photo_url: string | null;
}

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  match_id: number | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusLabel(status: string) {
  switch (status) {
    case "matched": return "Match Found";
    case "returned": return "Returned";
    default: return "Searching for match...";
  }
}

export default function StudentHome() {
  const [userName, setUserName] = useState("");
  const [userInitial, setUserInitial] = useState("?");

  const [myReports, setMyReports] = useState<LostReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedMyReport, setSelectedMyReport] = useState<LostReport | null>(null);

  const [publicReports, setPublicReports] = useState<PublicLostReport[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);

  const [matchNotification, setMatchNotification] = useState<NotificationItem | null>(null);
  const [showNotification, setShowNotification] = useState(true);

  const markNotificationRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`);
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("findnest_user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUserName(user.name || "");
      setUserInitial((user.name || "?").charAt(0).toUpperCase());
    }

    const fetchMyReports = async () => {
      try {
        const response = await api.get("/lost-items/my-reports");
        setMyReports(response.data.reports || []);
      } catch (err) {
        console.error("Error fetching my reports:", err);
      } finally {
        setReportsLoading(false);
      }
    };

    const fetchPublicReports = async () => {
      try {
        const response = await api.get("/lost-items", { params: { status: "searching" } });
        setPublicReports(response.data.reports || []);
      } catch (err) {
        console.error("Error fetching public lost item reports:", err);
      } finally {
        setPublicLoading(false);
      }
    };

    const fetchNotifications = async () => {
      try {
        const response = await api.get("/notifications");
        const notifications: NotificationItem[] = response.data.notifications || [];
        const unreadMatch = notifications.find(
          (n) => !n.is_read && n.type?.toLowerCase().includes("match")
        );
        setMatchNotification(unreadMatch || null);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };

    fetchMyReports();
    fetchPublicReports();
    fetchNotifications();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <a href="/student-home" className="text-lg font-black text-[#1a237e] hover:opacity-80 transition">
            FIND<span className="text-[#ffd700]">NEST</span>
          </a>
        </div>

        <div className="flex items-center gap-8">
          <a href="/student-home" className="text-[#1a237e] font-bold text-sm border-b-2 border-[#1a237e] pb-1">Home</a>
          <a href="/claim-status" className="text-gray-500 hover:text-[#1a237e] transition text-sm font-medium">Claim Status</a>
          <a href="/support" className="text-gray-500 hover:text-[#1a237e] transition text-sm font-medium">Support</a>
        </div>

        <div className="flex items-center gap-4">
          <a href="/notifications" className="relative w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-xl flex items-center justify-center transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {matchNotification && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">1</span>
            )}
          </a>
          <a href="/profile" className="w-10 h-10 bg-[#1a237e] rounded-full flex items-center justify-center text-white font-bold">
            {userInitial}
          </a>
        </div>
      </nav>

      <main className="px-8 py-8 max-w-6xl mx-auto">
        {matchNotification && showNotification && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-4 mb-8 flex items-center justify-between">
            <div>
              <p className="font-bold text-green-700 text-sm">{matchNotification.title}</p>
              <p className="text-green-600 text-sm">{matchNotification.message}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/matched-item?matchId=${matchNotification.match_id}`}
                onClick={() => { markNotificationRead(matchNotification.id); setShowNotification(false); }}
                className="text-sm font-bold text-[#1a237e] hover:underline"
              >
                View Match
              </a>
              <button
                onClick={() => { markNotificationRead(matchNotification.id); setShowNotification(false); }}
                className="text-green-400 hover:text-green-600 transition font-bold text-sm px-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-8">

          <a
            href="/report-lost"
            className="bg-red-500 hover:bg-red-600 rounded-2xl p-6 text-white transition shadow-lg hover:-translate-y-1 transform flex items-center gap-4"
          >
            <div>
              <p className="font-black text-lg">Report Lost Items</p>
              <p className="text-red-100 text-xs">Submit a lost item report</p>
            </div>
          </a>

          <a
            href="/report-found"
            className="bg-green-500 hover:bg-green-600 rounded-2xl p-6 text-white transition shadow-lg hover:-translate-y-1 transform flex items-center gap-4"
          >
            <div>
              <p className="font-black text-lg">Report Found Item</p>
              <p className="text-green-100 text-xs">Turn in an item you found</p>
            </div>
          </a>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="font-black text-gray-700 text-sm mb-3">Active Lost Item Reports</p>
            {reportsLoading ? (
              <p className="text-gray-400 text-xs">Loading...</p>
            ) : myReports.filter((r) => r.status === "searching").length === 0 ? (
              <p className="text-gray-400 text-xs">No active reports</p>
            ) : (
              <div className="space-y-2">
                {myReports
                  .filter((r) => r.status === "searching")
                  .slice(0, 2)
                  .map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedMyReport(report)}
                      className="w-full flex items-center gap-3 text-left hover:bg-gray-50 rounded-xl p-1.5 -m-1.5 transition"
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                        {report.photo_url ? (
                          <img src={report.photo_url} alt={report.item_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-[9px] font-bold">
                            No Photo
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-700 text-sm">{report.item_name}</p>
                        <p className="text-gray-400 text-xs">Searching</p>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-1">
            <p className="font-black text-gray-700 text-lg">Report Items</p>
            <span className="text-gray-400 text-xs">{publicReports.length} active</span>
          </div>
          <p className="text-gray-400 text-xs mb-5">
            Items reported lost by other students &mdash; photos are blurred to prevent false claims
          </p>

          {publicLoading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading reports...</p>
          ) : publicReports.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm font-bold">No active lost reports</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {publicReports.map((item) => (
                <div key={item.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="w-full h-28 bg-gray-100 overflow-hidden">
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt={item.item_name}
                        className="w-full h-full object-cover"
                        style={{ filter: "blur(10px)", transform: "scale(1.1)" }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">
                        No Photo
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-gray-700 text-xs truncate">{item.item_name}</p>
                    <p className="text-gray-400 text-[10px] mt-1">{item.category}</p>
                    <p className="text-gray-400 text-[10px]">{formatDate(item.date_lost)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedMyReport && (
        <div
          onClick={() => setSelectedMyReport(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm px-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 cursor-default"
          >
            <button
              onClick={() => setSelectedMyReport(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition text-xl font-bold leading-none"
            >
              &times;
            </button>

            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4">
              {selectedMyReport.photo_url ? (
                <img src={selectedMyReport.photo_url} alt={selectedMyReport.item_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Photo Available</div>
              )}
            </div>

            <h3 className="font-black text-[#1a237e] text-lg">{selectedMyReport.item_name}</h3>
            <span className="inline-block mt-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700">
              {statusLabel(selectedMyReport.status)}
            </span>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Category</span>
                <span className="font-bold text-gray-700">{selectedMyReport.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Location Lost</span>
                <span className="font-bold text-gray-700">{selectedMyReport.location_lost}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date Lost</span>
                <span className="font-bold text-gray-700">{formatDate(selectedMyReport.date_lost)}</span>
              </div>
            </div>

            {(selectedMyReport.ai_description || selectedMyReport.description) && (
              <div className="mt-4 bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Description</p>
                <p className="text-gray-700 text-sm">{selectedMyReport.ai_description || selectedMyReport.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}