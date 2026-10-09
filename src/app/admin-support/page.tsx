"use client";
// Admin > Support Inbox (/admin-support). Gmail-style: list + conversation, search, filters.
// API: GET /support, POST /support/{id}/read, GET /support/{id}/thread, POST /support/{id}/reply,
import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import AdminLayout from "@/components/AdminLayout";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

const PAGE_SIZE = 5;

interface SupportMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
  is_override_request?: boolean;
  override_status?: string | null;
}

interface SupportReplyItem {
  id: number;
  sender_type: "student" | "admin";
  message: string;
  created_at: string;
  user: { id: number; name: string } | null;
}

type StatusFilter = "all" | "new" | "read" | "responded";

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

// Short label for the status chip
function statusChip(status: string) {
  if (status === "new") return { label: "NEW", cls: "bg-red-50 text-red-600" };
  if (status === "responded") return { label: "REPLIED", cls: "bg-green-50 text-green-700" };
  return { label: "READ", cls: "bg-gray-100 text-gray-500" };
}

export default function SupportInbox() {
  return (
    <AuthGate allowedRole="admin">
      <SupportInboxContent />
    </AuthGate>
  );
}

function SupportInboxContent() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replies, setReplies] = useState<SupportReplyItem[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Loads every support message (newest first)
  const fetchMessages = async () => {
    try {
      const response = await api.get("/support");
      setMessages(response.data.messages || []);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
      } else {
        console.error("Error fetching support messages:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);
  useAutoRefresh(fetchMessages);

  const fetchThread = async (id: number) => {
    setThreadLoading(true);
    try {
      const response = await api.get(`/support/${id}/thread`);
      setReplies(response.data.replies || []);
    } catch (err) {
      console.error("Error fetching thread:", err);
    } finally {
      setThreadLoading(false);
    }
  };

  // Opens a conversation and marks it read
  const openMessage = async (msg: SupportMessage) => {
    setSelectedId(msg.id);
    setReplyText("");
    setReplies([]);
    fetchThread(msg.id);
    if (msg.status === "new") {
      try {
        await api.post(`/support/${msg.id}/read`);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: "read" } : m)));
      } catch (err) {
        console.error("Error marking message as read:", err);
      }
    }
  };

  const handleSendReply = async (id: number) => {
    if (!replyText.trim()) return;
    setReplySending(true);
    try {
      await api.post(`/support/${id}/reply`, { message: replyText.trim() });
      setReplyText("");
      fetchThread(id);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: "responded" } : m)));
    } catch (err) {
      console.error("Error sending reply:", err);
    } finally {
      setReplySending(false);
    }
  };

  // Approve or deny a manual AI override request from inside the conversation
  const handleOverride = async (id: number, decision: "approve" | "deny") => {
    setOverrideBusy(true);
    try {
      const res = await api.post(`/support/${id}/resolve-override`, { decision });
      const updated = res.data.data;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, override_status: updated?.override_status ?? (decision === "approve" ? "approved" : "denied"), status: "responded" }
            : m
        )
      );
      setToast(decision === "approve" ? "Override approved." : "Override denied.");
    } catch (err) {
      console.error("Error resolving override:", err);
      setToast("Failed to resolve the request.");
    } finally {
      setOverrideBusy(false);
    }
  };

  const counts = useMemo(
    () => ({
      all: messages.length,
      new: messages.filter((m) => m.status === "new").length,
      read: messages.filter((m) => m.status === "read").length,
      responded: messages.filter((m) => m.status === "responded").length,
    }),
    [messages]
  );

  // Search + status filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return messages.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    });
  }, [messages, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selected = messages.find((m) => m.id === selectedId) || null;

  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1
  );

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "read", label: "Read" },
    { key: "responded", label: "Replied" },
  ];

  if (accessDenied) {
    return (
      <AdminLayout active="/admin-support">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-gray-700 mb-2">Access Restricted</h1>
            <p className="text-gray-400 text-sm">
              Your account does not have permission to view Support Inbox. Contact the Super Admin if you believe this is a mistake.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active="/admin-support">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#1a237e] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-[#1a237e]">Support Inbox</h1>
          <p className="text-gray-400 text-sm mt-1">Messages sent by students through the Support page</p>
        </div>
        {counts.new > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <span className="text-red-600 text-sm font-bold">{counts.new} new</span>
          </div>
        )}
      </div>

      {/* Two panes: list + conversation. Below xl only one shows at a time. */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* LIST */}
        <div className={`xl:col-span-2 min-w-0 ${selected ? "hidden xl:block" : ""}`}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 space-y-3">
              <input
                type="text"
                placeholder="Search name, email, or message..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setStatusFilter(t.key); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      statusFilter === t.key
                        ? "bg-[#1a237e] text-white"
                        : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#1a237e]"
                    }`}
                  >
                    {t.label} ({counts[t.key]})
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Loading messages...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="font-bold text-lg">{messages.length === 0 ? "No messages yet" : "No matches"}</p>
                <p className="text-sm mt-1">
                  {messages.length === 0 ? "Student support messages will appear here" : "Try a different search or filter"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pageRows.map((msg) => {
                  const chip = statusChip(msg.status);
                  return (
                    <button
                      key={msg.id}
                      onClick={() => openMessage(msg)}
                      className={`w-full flex items-start gap-3 px-4 py-4 text-left transition ${
                        selectedId === msg.id ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0">
                        {msg.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm text-gray-700 ${msg.status === "new" ? "font-black" : "font-bold"}`}>{msg.name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.label}</span>
                          {msg.is_override_request && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                              Override {msg.override_status || "request"}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5 truncate">{msg.email}</p>
                        <p className="text-gray-500 text-xs mt-1 truncate">{msg.message}</p>
                        <p className="text-gray-300 text-[10px] mt-1">{formatTime(msg.created_at)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {filtered.length > 0 && (
              <div className="px-4 py-4 border-t border-gray-100 flex flex-wrap gap-3 items-center justify-between">
                <p className="text-gray-400 text-xs">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}&ndash;{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-xs hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {pageNums.map((p, idx) => (
                    <span key={p} className="flex items-center gap-2">
                      {idx > 0 && p - pageNums[idx - 1] > 1 && <span className="text-gray-300">&hellip;</span>}
                      <button
                        onClick={() => setPage(p)}
                        className={
                          p === safePage
                            ? "px-3 py-1.5 bg-[#1a237e] rounded-lg text-white text-xs font-bold"
                            : "px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-xs hover:border-[#1a237e] hover:text-[#1a237e] transition"
                        }
                      >
                        {p}
                      </button>
                    </span>
                  ))}
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
        </div>

        {/* CONVERSATION */}
        <div className={`xl:col-span-3 min-w-0 ${selected ? "" : "hidden xl:block"}`}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {selected ? (
              <>
                <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="xl:hidden text-[#1a237e] text-sm font-bold hover:underline"
                  >
                    &larr; Back
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0">
                    {selected.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-700">{selected.name}</p>
                    <p className="text-gray-400 text-xs truncate">{selected.email}</p>
                  </div>
                  <span className="text-gray-400 text-xs">{formatTime(selected.created_at)}</span>
                </div>

                <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                  {selected.is_override_request && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-amber-800 text-xs font-bold">Manual AI override request</p>
                      <p className="text-amber-700 text-xs mt-0.5">
                        The student says their photo is unclear and asks to fill in the details manually.
                      </p>
                      {selected.override_status === "pending" ? (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            onClick={() => handleOverride(selected.id, "approve")}
                            disabled={overrideBusy}
                            className="bg-green-50 hover:bg-green-500 hover:text-white text-green-600 text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOverride(selected.id, "deny")}
                            disabled={overrideBusy}
                            className="bg-red-50 hover:bg-red-500 hover:text-white text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            Deny
                          </button>
                        </div>
                      ) : (
                        <p className="text-amber-800 text-xs font-bold mt-2 capitalize">Status: {selected.override_status || "resolved"}</p>
                      )}
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                  </div>

                  {threadLoading ? (
                    <p className="text-gray-400 text-xs">Loading conversation...</p>
                  ) : (
                    replies.map((r) => (
                      <div
                        key={r.id}
                        className={`rounded-xl p-4 ${r.sender_type === "admin" ? "bg-blue-50 sm:ml-8" : "bg-gray-50 sm:mr-8"}`}
                      >
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                          {r.sender_type === "admin" ? "Guidance Office" : selected.name} &middot; {formatTime(r.created_at)}
                        </p>
                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{r.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 border-t border-gray-100 flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 min-w-[10rem] px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-sm text-gray-800"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSendReply(selected.id); }}
                  />
                  <button
                    onClick={() => handleSendReply(selected.id)}
                    disabled={replySending || !replyText.trim()}
                    className="bg-[#1a237e] hover:bg-[#283593] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
                  >
                    {replySending ? "Sending..." : "Reply"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-24 text-gray-400 text-sm">Select a message to read and reply.</div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}