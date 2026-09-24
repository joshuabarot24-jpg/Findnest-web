"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";

interface SupportMessage {
  id: number;
  message: string;
  status: string;
  created_at: string;
}

interface SupportReplyItem {
  id: number;
  sender_type: "student" | "admin";
  message: string;
  created_at: string;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

export default function SupportPage() {
  return (
    <AuthGate allowedRole="student">
      <SupportContent />
    </AuthGate>
  );
}

function SupportContent() {
  const [userInitial, setUserInitial] = useState("");

  const [myMessages, setMyMessages] = useState<SupportMessage[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [replies, setReplies] = useState<SupportReplyItem[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("findnest_user");
    if (stored) {
      const currentUser = JSON.parse(stored);
      setUserInitial(currentUser?.name?.charAt(0).toUpperCase() || "");
    }
  }, []);

  const fetchMyMessages = async () => {
    try {
      const res = await api.get("/support/my-messages");
      setMyMessages(res.data.messages || []);
    } catch (err) {
      console.error("Error fetching my messages:", err);
    } finally {
      setConversationsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyMessages();
  }, []);

  const fetchThread = async (id: number) => {
    setThreadLoading(true);
    try {
      const res = await api.get(`/support/${id}/thread`);
      setReplies(res.data.replies || []);
    } catch (err) {
      console.error("Error fetching thread:", err);
    } finally {
      setThreadLoading(false);
    }
  };

  const handleExpand = (msg: SupportMessage) => {
    if (expandedId === msg.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(msg.id);
    setReplyText("");
    fetchThread(msg.id);
  };

  const handleSendReply = async (id: number) => {
    if (!replyText.trim()) return;
    setReplySending(true);
    try {
      await api.post(`/support/${id}/reply`, { message: replyText.trim() });
      setReplyText("");
      fetchThread(id);
      fetchMyMessages();
    } catch (err) {
      console.error("Error sending reply:", err);
    } finally {
      setReplySending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc]">

      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <a href="/student-home" className="flex items-center gap-3">
          <span className="text-lg font-black text-[#1a237e]">FIND<span className="text-[#ffd700]">NEST</span></span>
        </a>
        <div className="flex items-center gap-8">
          <a href="/student-home" className="text-gray-500 hover:text-[#1a237e] transition text-sm font-medium">Home</a>
          <a href="/claim-status" className="text-gray-500 hover:text-[#1a237e] transition text-sm font-medium">Claim Status</a>
        </div>
        <div className="flex items-center gap-4">
          <a href="/notifications" className="relative w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-xl flex items-center justify-center transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </a>
          <a href="/profile" className="w-10 h-10 bg-[#1a237e] rounded-full flex items-center justify-center text-white font-bold text-sm">{userInitial}</a>
        </div>
      </nav>

      <main className="px-8 py-10 max-w-4xl mx-auto">

        <div className="mb-10">
          <h1 className="text-3xl font-black text-[#1a237e]">Support Conversations</h1>
          <p className="text-gray-400 text-sm mt-1">Continue your conversation with the Guidance Office &mdash; to start a new message, use the FAQ widget on Home</p>
        </div>

        {conversationsLoading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading conversations...</div>
        ) : myMessages.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center py-16">
            <p className="font-bold text-gray-700 text-lg">No conversations yet</p>
            <p className="text-gray-400 text-sm mt-2">Send a message from the Home page to start a conversation with the Guidance Office</p>
            <a href="/student-home" className="inline-block mt-5 bg-[#1a237e] hover:bg-[#283593] text-white font-bold px-6 py-3 rounded-xl transition">
              Go to Home
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="space-y-3">
              {myMessages.map((msg) => (
                <div key={msg.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => handleExpand(msg)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-700 text-sm truncate">{msg.message}</p>
                        {msg.status === "responded" && (
                          <span className="bg-green-50 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">REPLIED</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs mt-1">{formatTime(msg.created_at)}</p>
                    </div>
                  </button>

                  {expandedId === msg.id && (
                    <div className="px-6 pb-5 space-y-3">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-gray-700 text-sm leading-relaxed">{msg.message}</p>
                      </div>

                      {threadLoading ? (
                        <p className="text-gray-400 text-xs">Loading conversation...</p>
                      ) : (
                        replies.map((r) => (
                          <div
                            key={r.id}
                            className={`rounded-xl p-4 ${r.sender_type === "admin" ? "bg-blue-50 mr-8" : "bg-gray-50 ml-8"}`}
                          >
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                              {r.sender_type === "admin" ? "Guidance Office" : "You"} &middot; {formatTime(r.created_at)}
                            </p>
                            <p className="text-gray-700 text-sm">{r.message}</p>
                          </div>
                        ))
                      )}

                      <div className="flex gap-2 pt-1">
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
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}