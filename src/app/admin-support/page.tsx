"use client";
import { useState, useEffect } from "react";
import api, { logoutUser } from "@/lib/api";

interface SupportMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
}

interface SupportReplyItem {
  id: number;
  sender_type: "student" | "admin";
  message: string;
  created_at: string;
  user: { id: number; name: string } | null;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

export default function SupportInbox() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [replies, setReplies] = useState<SupportReplyItem[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);

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

  const handleExpand = async (msg: SupportMessage) => {
    if (expandedId === msg.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(msg.id);
    setReplyText("");
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

  const newCount = messages.filter((m) => m.status === "new").length;

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex">
      <aside className="w-72 bg-[#1a237e] min-h-screen flex flex-col fixed left-0 top-0 bottom-0">
        <div className="flex items-center gap-3 px-6 py-6">
          <div>
            <a href="/dashboard" className="text-white font-black text-lg block hover:opacity-80 transition">
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
          <a href="/location-analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Location Analytics</span>
          </a>
          <a href="/admin-user-management" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>User Management</span>
          </a>
          <a href="/digital-records" className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium">
            <span>Digital Records</span>
          </a>
          <a href="/admin-support" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 text-white font-semibold border border-white/20">
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
              Your account does not have permission to view Support Inbox. Contact the Super Admin if you believe this is a mistake.
            </p>
          </div>
        </div>
      ) : (
      <main className="flex-1 ml-72 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-[#1a237e]">Support Inbox</h1>
            <p className="text-gray-400 text-sm mt-1">Messages sent by students through the Support page</p>
          </div>
          {newCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <span className="text-red-600 text-sm font-bold">{newCount} new</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-bold text-lg">No messages yet</p>
              <p className="text-sm mt-1">Student support messages will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {messages.map((msg) => (
                <div key={msg.id}>
                  <button
                    onClick={() => handleExpand(msg)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#1a237e] to-[#1565c0] rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0">
                        {msg.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-700 text-sm">{msg.name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            msg.status === "new" ? "bg-red-50 text-red-600" : msg.status === "responded" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {msg.status === "new" ? "NEW" : msg.status === "responded" ? "REPLIED" : "READ"}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5">{msg.email}</p>
                        {expandedId !== msg.id && (
                          <p className="text-gray-500 text-xs mt-1 truncate">{msg.message}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-400 text-xs shrink-0 ml-4">{formatTime(msg.created_at)}</span>
                  </button>

                  {expandedId === msg.id && (
                    <div className="px-6 pb-5">
                      <div className="ml-14 space-y-3">
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-gray-700 text-sm leading-relaxed">{msg.message}</p>
                        </div>

                        {threadLoading ? (
                          <p className="text-gray-400 text-xs">Loading conversation...</p>
                        ) : (
                          replies.map((r) => (
                            <div
                              key={r.id}
                              className={`rounded-xl p-4 ${r.sender_type === "admin" ? "bg-blue-50 ml-8" : "bg-gray-50 mr-8"}`}
                            >
                              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                                {r.sender_type === "admin" ? "Guidance Office" : msg.name} &middot; {formatTime(r.created_at)}
                              </p>
                              <p className="text-gray-700 text-sm">{r.message}</p>
                            </div>
                          ))
                        )}

                        <div className="flex gap-2 pt-2">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type your reply..."
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-sm text-gray-800"
                            onKeyDown={(e) => { if (e.key === "Enter") handleSendReply(msg.id); }}
                          />
                          <button
                            onClick={() => handleSendReply(msg.id)}
                            disabled={replySending || !replyText.trim()}
                            className="bg-[#1a237e] hover:bg-[#283593] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
                          >
                            {replySending ? "Sending..." : "Reply"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      )}
    </div>
  );
}