"use client";
// Student > Home (/student-home). Hero, reported lost items (all students) and the student's own found reports.
// API: /lost-items, /lost-items/my-reports, /found-items, /notifications, /support
import { useState, useEffect } from "react";
import api from "@/lib/api";
import StudentLayout from "@/components/StudentLayout";
import MatchBanner from "@/components/MatchBanner";
import AuthGate from "@/components/AuthGate";
import HeroCarousel from "@/components/HeroCarousel";

interface FoundReport {
  id: number;
  item_name: string;
  category: string;
  status: string;
  photo_url: string | null;
  location_found: string;
  date_found: string | null;
  description: string | null;
  ai_description: string | null;
  receipt_confirmed?: boolean;
}

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
  created_at: string;
  match_id: number | null;
}

const FAQ_ITEMS = [
  {
    q: "How do I report a lost item?",
    a: "Click \"Lost something\" on the Home page, upload a clear photo, and fill in the details. Our AI will help auto-fill some fields for you.",
  },
  {
    q: "How do I know if my item was found?",
    a: "You'll get a notification the moment the AI finds a likely match. Check the bell icon at the top of this page.",
  },
  {
    q: "How does the claim process work?",
    a: "Once matched, submit a claim with proof (description and photos). You may also be asked verification questions before an admin reviews it.",
  },
  {
    q: "What if my claim gets rejected?",
    a: "You can appeal a rejected claim from your Claim Status page. The appeal is reviewed by the Super Admin.",
  },
  {
    q: "Where do I pick up my item once approved?",
    a: "Visit the Guidance Office within the pickup deadline shown on your Claim Status page.",
  },
];

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

function foundStatusLabel(r: FoundReport) {
  return r.receipt_confirmed === false ? "Awaiting surrender" : r.status === "claimed" ? "Claimed" : "Unclaimed";
}

// Pagination bar: range text on the left, Previous / numbers / Next on the right
function Pager({ page, total, size, onChange }: { page: number; total: number; size: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);
  return (
    <div className="mt-auto pt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-gray-400 text-sm">Showing {from}&ndash;{to} of {total} items</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 text-sm hover:border-[#0E4D34] hover:text-[#0E4D34] transition disabled:opacity-40 disabled:cursor-not-allowed"
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
                  ? "w-9 h-9 rounded-lg bg-[#0E4D34] text-white text-sm font-bold"
                  : "w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-500 text-sm hover:border-[#0E4D34] hover:text-[#0E4D34] transition"
              }
            >
              {p}
            </button>
          </span>
        ))}
        <button
          onClick={() => onChange(Math.min(pages, page + 1))}
          disabled={page === pages}
          className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 text-sm hover:border-[#0E4D34] hover:text-[#0E4D34] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function StudentHome() {
  return (
    <AuthGate allowedRole="student">
      <StudentHomeContent />
    </AuthGate>
  );
}

function StudentHomeContent() {
  const [tab, setTab] = useState<"lost" | "found">("lost");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const [myReports, setMyReports] = useState<LostReport[]>([]);
  const [selectedMyReport, setSelectedMyReport] = useState<LostReport | null>(null);
  const [deletingReport, setDeletingReport] = useState<LostReport | null>(null);
  const [myFoundReports, setMyFoundReports] = useState<FoundReport[]>([]);
  const [foundReportsLoading, setFoundReportsLoading] = useState(true);
  const [selectedMyFoundReport, setSelectedMyFoundReport] = useState<FoundReport | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [publicReports, setPublicReports] = useState<PublicLostReport[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);

  const [matchNotifications, setMatchNotifications] = useState<NotificationItem[]>([]);

  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [chatbotInput, setChatbotInput] = useState("");
  const [chatbotThinking, setChatbotThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "bot"; text: string }[]>([]);
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [isOverrideRequest, setIsOverrideRequest] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [previewPublicReport, setPreviewPublicReport] = useState<PublicLostReport | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatSent, setChatSent] = useState(false);
  const [chatError, setChatError] = useState("");

  const markNotificationRead = async (id: number) => {
    // Remove it from the banner at once so the next match slides in
    setMatchNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.post(`/notifications/${id}/read`);
      window.dispatchEvent(new Event("findnest:notifs-changed"));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  async function handleSendMessage() {
    if (!chatMessage.trim()) {
      setChatError("Please type a message first.");
      return;
    }
    setChatError("");
    setChatSending(true);
    try {
      await api.post("/support", { message: chatMessage.trim(), is_override_request: isOverrideRequest });
      setChatMessage("");
      setIsOverrideRequest(false);
      setChatSent(true);
      setTimeout(() => setChatSent(false), 3000);
    } catch (err: any) {
      setChatError(err.response?.data?.message || "Failed to send. Please try again.");
    } finally {
      setChatSending(false);
    }
  }

  async function handleAskChatbot() {
    const question = chatbotInput.trim();
    if (!question) return;
    setChatHistory((prev) => [...prev, { role: "user", text: question }]);
    setChatbotInput("");
    setChatbotThinking(true);
    try {
      const res = await api.post("/support/ask", { question });
      setChatHistory((prev) => [...prev, { role: "bot", text: res.data.answer }]);
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: "bot", text: "Sorry, something went wrong. Please try again or send us a message below." }]);
    } finally {
      setChatbotThinking(false);
    }
  }

  useEffect(() => {
    const fetchMyFoundReports = async () => {
      try {
        const response = await api.get("/found-items");
        setMyFoundReports(response.data.records || []);
      } catch (err) {
        console.error("Error fetching my found reports:", err);
      } finally {
        setFoundReportsLoading(false);
      }
    };

    const fetchMyReports = async () => {
      try {
        const response = await api.get("/lost-items/my-reports");
        setMyReports(response.data.reports || []);
      } catch (err) {
        console.error("Error fetching my reports:", err);
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

    // Unread match notification shown as the green banner
    const fetchNotifications = async () => {
      try {
        const response = await api.get("/notifications");
        const notifications: NotificationItem[] = response.data.notifications || [];
        const unreadMatches = notifications.filter(
          (n) => !n.is_read && n.type?.toLowerCase().includes("match") && n.match_id
        );
        setMatchNotifications(unreadMatches);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };

    fetchMyReports();
    fetchMyFoundReports();
    fetchPublicReports();
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

    // Skeleton card shown while a list loads
  const SkeletonCard = (
    <div className="bg-[#F3FAF6] rounded-2xl border border-[#2FD18B] p-1.5">
      <div className="rounded-xl border border-gray-200 p-3">
      <div className="w-full h-36 bg-gray-100 rounded-xl flex items-center justify-center text-gray-300">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg>
      </div>
      <div className="h-3 bg-[#0E4D34] rounded-full mt-3 w-3/4" />
      <div className="h-2 bg-[#BFE3CF] rounded-full mt-2 w-1/2" />
      <div className="h-2 bg-[#BFE3CF] rounded-full mt-2 w-2/5" />
      </div>
    </div>
  );

  return (
    <StudentLayout active="/student-home">
      <div className="w-full flex-1 flex flex-col pb-20">
        <MatchBanner
          items={matchNotifications}
          onView={(n) => markNotificationRead(n.id)}
          onDismiss={(n) => markNotificationRead(n.id)}
        />

        {/* Hero */}
        <section className="grid grid-cols-1 md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] gap-6 md:gap-10 items-start mb-6">
          <HeroCarousel />

          <div>
            <h1 className="font-black leading-[1.05] text-3xl sm:text-4xl xl:text-5xl tracking-tight">
              <span className="block text-[#0E4D34]">NEVER LOST</span>
              <span className="block"><span className="text-[#2FD18B]">WHAT</span> <span className="text-[#0E4D34]">MATTERS</span></span>
              <span className="block text-[#2FD18B]">MOST.</span>
            </h1>
            <p className="text-gray-700 text-sm font-bold mt-3 max-w-md leading-relaxed">
              FindNest uses advanced AI image recognition to match lost and found items on campus. Submit a report, get notified instantly.
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <a href="/report-lost" className="flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold text-sm px-5 py-2.5 rounded-full transition">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v5" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
                Lost something
              </a>
              <a href="/report-found" className="flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm px-5 py-2.5 rounded-full transition">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /><path d="M11 8v6" /><path d="M8 11h6" /></svg>
                Found Something
              </a>
              <a href="/claim-status" className="flex items-center gap-2 bg-[#D9E8DF] hover:bg-[#C9DCD2] text-[#1F2937] font-bold text-sm px-5 py-2.5 rounded-full transition">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" /><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" /></svg>
                Claim Status
              </a>
            </div>
          </div>
        </section>

        {/* Tabs: all students' lost reports / this student's own found reports */}
        <section className="flex-1 flex flex-col">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className="w-1.5 h-6 rounded-full bg-[#2FD18B]" />
            <h2 className="text-xl font-black text-gray-800">{tab === "lost" ? "Reported Lost Items" : "Your Reported Found Items"}</h2>
            <span className="text-gray-400 text-xs">
              {tab === "lost" ? `${publicReports.length} active` : `${myFoundReports.length} reported`}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => { setTab("lost"); setPage(1); }}
              className={`px-5 py-2 rounded-full text-sm font-bold transition ${tab === "lost" ? "bg-[#0E4D34] text-white" : "bg-white text-gray-600 hover:bg-[#D9E8DF]"}`}
            >
              Reported Lost Items
            </button>
            <button
              onClick={() => { setTab("found"); setPage(1); }}
              className={`px-5 py-2 rounded-full text-sm font-bold transition ${tab === "found" ? "bg-[#0E4D34] text-white" : "bg-white text-gray-600 hover:bg-[#D9E8DF]"}`}
            >
              Your Reported Found Items
            </button>
          </div>
          <p className="text-gray-400 text-xs mb-6">
            {tab === "lost"
              ? "Items reported lost by students. Photos are blurred to prevent false claims."
              : "Only the items you reported as found are shown here."}
          </p>

          {tab === "lost" ? (
            publicLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i}>{SkeletonCard}</div>)}</div>
            ) : publicReports.length === 0 ? (
              <div className="bg-white rounded-2xl text-center py-12 text-gray-400 text-sm font-bold">No active lost reports</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {publicReports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => {
                  const mine = myReports.find((r) => r.id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => (mine ? setSelectedMyReport(mine) : setPreviewPublicReport(item))}
                      className="bg-[#F3FAF6] rounded-2xl border border-[#2FD18B] p-1.5 text-left hover:shadow-md transition"
                    >
                      <div className="rounded-xl border border-gray-200 p-3">
                      <div className="relative w-full h-36 bg-gray-100 rounded-xl overflow-hidden">
                        {item.photo_url ? (
                          <img src={item.photo_url} alt={item.item_name} className="w-full h-full object-contain p-2" style={{ filter: "blur(6px)" }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">No Photo</div>
                        )}
                        {mine && <span className="absolute top-2 left-2 bg-[#0E4D34] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Yours</span>}
                      </div>
                      <p className="font-black text-[#0E4D34] text-base truncate mt-3">{item.item_name}</p>
                      <p className="text-gray-500 text-xs font-medium mt-1">{item.category}</p>
                      <p className="text-gray-500 text-xs font-medium mt-0.5">{formatDate(item.date_lost)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : foundReportsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i}>{SkeletonCard}</div>)}</div>
          ) : myFoundReports.length === 0 ? (
            <div className="bg-white rounded-2xl text-center py-12 text-gray-400 text-sm font-bold">You haven&apos;t reported any found items yet</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {myFoundReports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedMyFoundReport(report)}
                  className="bg-[#F3FAF6] rounded-2xl border border-[#2FD18B] p-1.5 text-left hover:shadow-md transition"
                >
                  <div className="rounded-xl border border-gray-200 p-3">
                  <div className="w-full h-36 bg-gray-100 rounded-xl overflow-hidden">
                    {report.photo_url ? (
                      <img src={report.photo_url} alt={report.item_name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">No Photo</div>
                    )}
                  </div>
                  <p className="font-black text-[#0E4D34] text-base truncate mt-3">{report.item_name}</p>
                  <p className="text-gray-500 text-xs font-medium mt-1">{report.category}</p>
                  <p className="text-gray-500 text-xs font-medium mt-0.5">{report.date_found ? formatDate(report.date_found) : foundStatusLabel(report)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <Pager
            page={page}
            total={tab === "lost" ? publicReports.length : myFoundReports.length}
            size={PAGE_SIZE}
            onChange={setPage}
          />
        </section>
      </div>

      {previewPublicReport && (
        <div
          onClick={() => setPreviewPublicReport(null)}
          className="fixed inset-0 z-[140] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm cursor-default"
          >
            <button
              onClick={() => setPreviewPublicReport(null)}
              className="absolute -top-4 -right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition text-2xl font-bold leading-none shadow-lg border border-gray-200 z-20"
            >
              &times;
            </button>
            <div className="p-6 max-h-[90vh] overflow-y-auto">

            <div className="w-full rounded-2xl overflow-hidden bg-gray-100 mb-4 flex items-center justify-center">
              {previewPublicReport.photo_url ? (
                <img
                  src={previewPublicReport.photo_url}
                  alt={previewPublicReport.item_name}
                  className="w-full max-h-[60vh] object-contain"
                  style={{ filter: "blur(10px)" }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Photo Available</div>
              )}
            </div>

            <h3 className="font-black text-[#0E4D34] text-lg">{previewPublicReport.item_name}</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Category</span>
                <span className="font-bold text-gray-700">{previewPublicReport.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date Lost</span>
                <span className="font-bold text-gray-700">{formatDate(previewPublicReport.date_lost)}</span>
              </div>
            </div>
            <p className="text-gray-400 text-xs mt-4 text-center">
              Full details are only revealed to the student if this matches their own lost report.
            </p>
            </div>
          </div>
        </div>
      )}

      {!chatbotOpen && (
        <button
          onClick={() => setChatbotOpen(true)}
          className="fixed bottom-4 right-4 z-[150] flex items-center gap-2 bg-[#0E4D34] hover:bg-[#0A3021] text-white rounded-full shadow-2xl transition pl-2 pr-4 py-2 hover:-translate-y-0.5"
        >
          <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              <circle cx="9" cy="10" r="1" fill="currentColor" />
              <circle cx="15" cy="10" r="1" fill="currentColor" />
            </svg>
          </div>
          <span className="font-bold text-sm">Ask me!</span>
        </button>
      )}

      {chatbotOpen && (
        <div className="fixed bottom-6 right-6 z-[150] w-96 max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden" style={{ height: "560px", maxHeight: "calc(100vh - 3rem)" }}>
          <div className="bg-[#0E4D34] px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm">FindNest Assistant</p>
                <p className="text-white/70 text-[10px]">Ask me how FindNest works</p>
              </div>
            </div>
            <button onClick={() => setChatbotOpen(false)} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {chatHistory.length === 0 && (
              <div className="mb-3">
                <p className="text-gray-400 text-[10px] font-bold uppercase mb-2">Common Questions</p>
                <div className="space-y-1.5">
                  {FAQ_ITEMS.map((item, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition"
                      >
                        <span className="text-gray-700 text-xs font-bold pr-2">{item.q}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${openFaqIndex === idx ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {openFaqIndex === idx && (
                        <div className="px-3 pb-2.5">
                          <p className="text-gray-500 text-[11px] leading-relaxed">{item.a}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-center py-4">
                  <p className="text-gray-400 text-xs">Or ask me your own question below!</p>
                  <button
                    type="button"
                    onClick={() => { setShowMessageBox(true); setIsOverrideRequest(true); }}
                    className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-[#0E4D34] text-[#0E4D34] bg-white hover:bg-[#F3FAF6] font-bold text-xs rounded-full py-2.5 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Request Manual AI Override
                  </button>
                  <p className="text-[#6b8f7c] text-[10px] mt-1.5">
                    Photo unclear and the AI can&apos;t read it? Click here to ask the office.
                  </p>
                </div>
              </div>
            )}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === "user" ? "bg-[#0E4D34] text-white" : "bg-white text-gray-700 border border-gray-100"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {chatbotThinking && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl px-3.5 py-2.5">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 p-3 flex-shrink-0 overflow-y-auto" style={{ maxHeight: "60%" }}>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatbotInput}
                onChange={(e) => setChatbotInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAskChatbot(); }}
                placeholder="Type your question..."
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E4D34] text-gray-700 text-xs"
              />
              <button
                onClick={handleAskChatbot}
                disabled={chatbotThinking || !chatbotInput.trim()}
                className="bg-[#0E4D34] hover:bg-[#0A3021] text-white px-4 rounded-xl transition disabled:opacity-50 text-xs font-bold"
              >
                Ask
              </button>
            </div>
            <button
              onClick={() => setShowMessageBox(!showMessageBox)}
              className="text-[#0E4D34] text-[10px] font-bold mt-2 hover:underline"
            >
              {showMessageBox ? "Hide" : "Still need help? Send a message to the office"}
            </button>
            {showMessageBox && (
              <div className="mt-2">
                <label className="flex items-start gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOverrideRequest}
                    onChange={(e) => setIsOverrideRequest(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-[10px] text-gray-500 leading-tight">
                    This is a request for a <strong>manual AI override</strong> — my photo is unclear and the AI cannot analyze it, so I need to fill in details manually.
                  </span>
                </label>
                <textarea
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder={isOverrideRequest ? "Explain why your photo isn't clear (e.g. item is in a dark bag, photo is blurry)..." : "Type your message here..."}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E4D34] text-gray-700 text-xs resize-none mb-2"
                />
                {chatError && <p className="text-red-500 text-[10px] font-semibold mb-1">{chatError}</p>}
                {chatSent && <p className="text-green-600 text-[10px] font-semibold mb-1">Message sent!</p>}
                <button
                  onClick={handleSendMessage}
                  disabled={chatSending}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2 rounded-xl transition disabled:opacity-50"
                >
                  {chatSending ? "Sending..." : isOverrideRequest ? "Send Override Request" : "Send Message to Office"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedMyReport && (
        <div
          onClick={() => setSelectedMyReport(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md cursor-default"
          >
            <button
              onClick={() => setSelectedMyReport(null)}
              className="absolute -top-4 -right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition text-2xl font-bold leading-none shadow-lg border border-gray-200 z-20"
            >
              &times;
            </button>
            <div className="p-6 max-h-[90vh] overflow-y-auto">

            <div className="w-full rounded-2xl overflow-hidden bg-gray-100 mb-4 flex items-center justify-center">
              {selectedMyReport.photo_url ? (
                <img src={selectedMyReport.photo_url} alt={selectedMyReport.item_name} className="w-full max-h-[60vh] object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Photo Available</div>
              )}
            </div>

            <h3 className="font-black text-[#0E4D34] text-lg">{selectedMyReport.item_name}</h3>
            <span className="inline-block mt-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700">
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

            <button
              onClick={() => { setDeletingReport(selectedMyReport); setDeleteReason(""); setSelectedMyReport(null); }}
              className="w-full mt-5 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 font-bold py-3 rounded-2xl transition text-sm"
            >
              Delete Report
            </button>
            </div>
          </div>
        </div>
      )}

      {selectedMyFoundReport && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm">
            <button onClick={() => setSelectedMyFoundReport(null)} className="absolute -top-4 -right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition text-2xl font-bold leading-none shadow-lg border border-gray-200 z-20">&times;</button>
            <div className="p-6 max-h-[90vh] overflow-y-auto">
            <div className="w-full rounded-2xl overflow-hidden bg-gray-100 mb-4 flex items-center justify-center">
              {selectedMyFoundReport.photo_url ? (
                <img src={selectedMyFoundReport.photo_url} alt={selectedMyFoundReport.item_name} className="w-full max-h-[60vh] object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Photo Available</div>
              )}
            </div>
            <h3 className="font-black text-[#0E4D34] text-lg">{selectedMyFoundReport.item_name}</h3>
            <span className="inline-block mt-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              {foundStatusLabel(selectedMyFoundReport)}
            </span>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Category</span>
                <span className="font-bold text-gray-700">{selectedMyFoundReport.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Location Found</span>
                <span className="font-bold text-gray-700">{selectedMyFoundReport.location_found}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date Found</span>
                <span className="font-bold text-gray-700">{selectedMyFoundReport.date_found ? formatDate(selectedMyFoundReport.date_found) : "—"}</span>
              </div>
            </div>
            {(selectedMyFoundReport.ai_description || selectedMyFoundReport.description) && (
              <div className="mt-4 bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Description</p>
                <p className="text-gray-700 text-sm">{selectedMyFoundReport.ai_description || selectedMyFoundReport.description}</p>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {deletingReport && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-black text-[#0E4D34] mb-1">Delete This Report?</h2>
            <p className="text-gray-400 text-sm mb-4">Let us know why you&apos;re deleting &quot;{deletingReport.item_name}&quot; — for example, if you found it yourself.</p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. Found it in my bag"
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none transition text-gray-700 resize-none mb-5 text-sm"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingReport(null)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!deletingReport) return;
                  setDeleteSubmitting(true);
                  try {
                    await api.delete(`/lost-items/${deletingReport.id}`, { data: { reason: deleteReason.trim() } });
                    setMyReports((prev) => prev.filter((r) => r.id !== deletingReport.id));
                    setPublicReports((prev) => prev.filter((r) => r.id !== deletingReport.id));
                    setDeletingReport(null);
                  } catch (err) {
                    console.error("Failed to delete report:", err);
                  } finally {
                    setDeleteSubmitting(false);
                  }
                }}
                disabled={deleteSubmitting || !deleteReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50 text-sm"
              >
                {deleteSubmitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}