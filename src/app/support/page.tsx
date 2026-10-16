"use client";
// Student > Support (/support). The student's conversations with the Guidance Office.
// API: /support/my-messages, /support/{id}/thread, /support/{id}/reply
import { useState, useEffect } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import StudentLayout from "@/components/StudentLayout";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

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
  const [myMessages, setMyMessages] = useState<SupportMessage[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [replies, setReplies] = useState<SupportReplyItem[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);

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

  // showSpinner is false for background refreshes so the open thread doesn't flicker
  const fetchThread = async (id: number, showSpinner = true) => {
    if (showSpinner) setThreadLoading(true);
    try {
      const res = await api.get(`/support/${id}/thread`);
      setReplies(res.data.replies || []);
    } catch (err) {
      console.error("Error fetching thread:", err);
    } finally {
      if (showSpinner) setThreadLoading(false);
    }
  };

  // Keep the list and the open conversation fresh
  useAutoRefresh(() => {
    fetchMyMessages();
    if (expandedId !== null) fetchThread(expandedId, false);
  });

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
      fetchThread(id, false);
      fetchMyMessages();
    } catch (err) {
      console.error("Error sending reply:", err);
    } finally {
      setReplySending(false);
    }
  };

  return (
    <StudentLayout active="/support">
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#0E4D34]">Support Conversations</h1>
          <p className="text-gray-500 text-sm mt-1">
            Continue your conversation with the Guidance Office. To start a new message, use the &quot;Ask me!&quot; button on Home.
          </p>
        </div>

        {conversationsLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-white h-20 animate-pulse" />
            ))}
          </div>
        ) : myMessages.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#D9E8DF] shadow-sm text-center py-16 px-6">
            <p className="font-bold text-gray-800 text-lg">No conversations yet</p>
            <p className="text-gray-500 text-sm mt-2">Send a message from the Home page to start a conversation with the Guidance Office</p>
            <a
              href="/student-home"
              className="inline-block mt-5 bg-[#0E4D34] hover:bg-[#0A3021] text-white font-bold px-6 py-3 rounded-full transition"
            >
              Go to Home
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#D9E8DF] shadow-sm p-5 sm:p-6">
            <div className="space-y-3">
              {myMessages.map((msg) => (
                <div key={msg.id} className="border border-[#D9E8DF] rounded-2xl overflow-hidden bg-[#F3FAF6]">
                  <button
                    onClick={() => handleExpand(msg)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#E3EEE7] transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#0A2618] text-sm truncate">{msg.message}</p>
                        {msg.status === "responded" && (
                          <span className="bg-[#0E4D34] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">REPLIED</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{formatTime(msg.created_at)}</p>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expandedId === msg.id ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {expandedId === msg.id && (
                    <div className="px-5 pb-5 space-y-3">
                      <div className="bg-white rounded-xl p-4 ml-8">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">You</p>
                        <p className="text-gray-700 text-sm leading-relaxed">{msg.message}</p>
                      </div>

                      {threadLoading ? (
                        <p className="text-gray-400 text-xs">Loading conversation...</p>
                      ) : (
                        replies.map((r) => (
                          <div
                            key={r.id}
                            className={`rounded-xl p-4 ${r.sender_type === "admin" ? "bg-[#B9CBBF] mr-8" : "bg-white ml-8"}`}
                          >
                            <p className={`text-[10px] font-bold uppercase mb-1 ${r.sender_type === "admin" ? "text-[#1E3F2E]" : "text-gray-400"}`}>
                              {r.sender_type === "admin" ? "Guidance Office" : "You"} &middot; {formatTime(r.created_at)}
                            </p>
                            <p className={`text-sm ${r.sender_type === "admin" ? "text-[#0A2618] font-medium" : "text-gray-700"}`}>{r.message}</p>
                          </div>
                        ))
                      )}

                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply..."
                          className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E4D34] text-sm text-gray-800 bg-white"
                          onKeyDown={(e) => { if (e.key === "Enter") handleSendReply(msg.id); }}
                        />
                        <button
                          onClick={() => handleSendReply(msg.id)}
                          disabled={replySending || !replyText.trim()}
                          className="bg-[#0E4D34] hover:bg-[#0A3021] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
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
      </div>
    </StudentLayout>
  );
}