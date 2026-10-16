"use client";
// Student > Notifications (/notifications). "Notification Box" card with sage-green badges.
// API: /notifications, /notifications/{id}/read, /notifications/read-all
import { useState, useEffect } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import StudentLayout from "@/components/StudentLayout";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  match_id: number | null;
}

// "Just now", "6 Hrs ago", "2 Days ago"
function formatTime(dateStr: string) {
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} Min${diffMins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(diffMins / 60);
  if (hrs < 24) return `${hrs} Hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} Day${days === 1 ? "" : "s"} ago`;
  return new Date(dateStr).toLocaleDateString();
}

// Tells the bell in the layout to refresh its count right away
function pingBell() {
  window.dispatchEvent(new Event("findnest:notifs-changed"));
}

export default function NotificationsPage() {
  return (
    <AuthGate allowedRole="student">
      <NotificationsContent />
    </AuthGate>
  );
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = async () => {
    try {
      const response = await api.get("/notifications");
      setNotifications(response.data.notifications || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      pingBell();
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      pingBell();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const handleNotifPress = async (n: NotificationItem) => {
    if (!n.is_read) {
      await handleMarkAsRead(n.id);
    }
    const t = n.type.toLowerCase();
    if (t.includes("support")) {
      window.location.href = "/support";
    } else if (t.includes("match") && n.match_id) {
      window.location.href = `/matched-item?matchId=${n.match_id}`;
    } else if (t.includes("status") || t.includes("reminder") || t.includes("claim")) {
      window.location.href = "/claim-status";
    }
  };

  useAutoRefresh(fetchNotifications);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const shownNotifications = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <StudentLayout active="/notifications">
      <div className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#0E4D34]">Notifications</h1>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                  filter === "all" ? "bg-[#0E4D34] text-white" : "text-gray-700 hover:bg-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                  filter === "unread" ? "bg-[#0E4D34] text-white" : "text-gray-700 hover:bg-white"
                }`}
              >
                Unread
              </button>
            </div>
            <p className="text-gray-500 text-sm mt-3">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "You are all caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllAsRead} className="text-sm font-bold text-[#0E4D34] hover:underline">
              Mark all as read
            </button>
          )}
        </div>

        {/* Notification Box */}
        <div className="bg-white rounded-3xl shadow-xl p-5 sm:p-6">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl bg-[#B9CBBF]/60 h-20 animate-pulse" />
              ))}
            </div>
          ) : shownNotifications.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <p className="font-bold text-lg">{filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
              <p className="text-sm mt-1">You will be notified when there is an update on your reports</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shownNotifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotifPress(n)}
                  className={`block w-full text-left rounded-xl bg-[#B9CBBF] px-5 py-4 hover:brightness-95 transition ${
                    !n.is_read ? "ring-1 ring-[#1B3B2B]/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0A2618]">{n.title}</p>
                      <p className="font-medium text-[#1E3F2E] text-sm mt-0.5">{n.message}</p>
                      <p className="text-[#1E3F2E]/80 text-xs mt-1.5">{formatTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0 mt-1.5" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}