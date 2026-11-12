"use client";
// Student > Support (/support). One chat with the Guidance Office.
// API: /support/my-conversation, /support/send
import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import StudentLayout from "@/components/StudentLayout";

interface StreamItem {
  key: string;
  kind: "message" | "reply" | "system";
  sender?: "student" | "admin";
  text: string;
  at: string;
  is_override_request?: boolean;
  override_status?: string | null;
  pending?: boolean;
  failed?: boolean;
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
  const [items, setItems] = useState<StreamItem[]>([]);
  const [temps, setTemps] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const fetchConversation = async () => {
    try {
      const res = await api.get("/support/my-conversation");
      setItems(res.data.items || []);
    } catch (err) {
      console.error("Error fetching the conversation:", err);
    } finally {
      setLoading(false);
    }
  };

  // Quick refresh while the page is open, and again when the tab is shown
  useEffect(() => {
    fetchConversation();
    const timer = setInterval(() => { if (document.visibilityState === "visible") fetchConversation(); }, 5000);
    const onShow = () => { if (document.visibilityState === "visible") fetchConversation(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onShow); };
  }, []);

  const shown = [...items, ...temps];
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [shown.length]);

  // The message appears at once, then is confirmed by the server
  const send = async (retry?: StreamItem) => {
    const body = (retry ? retry.text : text).trim();
    if (!body) return;
    const key = retry ? retry.key : `tmp-${Date.now()}`;
    if (retry) setTemps((prev) => prev.map((t) => (t.key === key ? { ...t, failed: false, pending: true } : t)));
    else {
      setTemps((prev) => [...prev, { key, kind: "message", sender: "student", text: body, at: new Date().toISOString(), pending: true }]);
      setText("");
    }
    try {
      await api.post("/support/send", { message: body });
      await fetchConversation();
      setTemps((prev) => prev.filter((t) => t.key !== key));
      window.dispatchEvent(new Event("findnest:counts-changed"));
    } catch (err) {
      setTemps((prev) => prev.map((t) => (t.key === key ? { ...t, pending: false, failed: true } : t)));
    }
  };

  return (
    <StudentLayout active="/support">
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#0E4D34]">Support</h1>
          <p className="text-gray-500 text-sm mt-1">Your conversation with the Guidance Office.</p>
        </div>

        <div className="bg-white rounded-3xl border border-[#D9E8DF] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="font-bold text-[#0A2618]">Guidance Office</p>
            <p className="text-gray-400 text-xs">Ms. Shelly S. Durban &middot; Mon-Fri, 8AM - 5PM</p>
          </div>

          <div className="p-5 flex flex-col gap-3 h-[55vh] overflow-y-auto">
            {loading ? (
              <p className="text-gray-400 text-xs">Loading conversation...</p>
            ) : shown.length === 0 ? (
              <div className="m-auto text-center">
                <p className="font-bold text-gray-800">No messages yet</p>
                <p className="text-gray-500 text-sm mt-1">Write below to contact the Guidance Office.</p>
              </div>
            ) : (
              shown.map((m) =>
                m.kind === "system" ? (
                  <p key={m.key} className="text-center text-gray-400 text-xs">{m.text}</p>
                ) : m.is_override_request ? (
                  <div key={m.key} className="self-end max-w-[85%] bg-amber-50/80 border border-amber-200 rounded-2xl p-4">
                    <p className="text-amber-800 text-xs font-bold">Manual AI override request</p>
                    <p className="text-amber-700 text-xs mt-1 whitespace-pre-wrap break-words">{m.text}</p>
                    <p className="text-amber-800 text-xs font-bold mt-2 capitalize">Status: {m.override_status || "pending"}</p>
                  </div>
                ) : (
                  <div key={m.key} className={`max-w-[75%] flex flex-col ${m.sender === "student" ? "self-end items-end" : "self-start items-start"}`}>
                    <p className="text-[11px] text-gray-500 mb-1">
                      {m.sender === "student" ? "You" : "Guidance Office"} &middot; {m.pending ? "Sending..." : formatTime(m.at)}
                    </p>
                    <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words ${m.sender === "student" ? "bg-[#0F4C3A] text-white rounded-tr-sm" : "bg-slate-100 text-slate-800 rounded-tl-sm"} ${m.pending ? "opacity-60" : ""}`}>
                      {m.text}
                    </div>
                    {m.failed && (
                      <button type="button" onClick={() => send(m)} className="text-[11px] font-bold text-red-500 mt-1 hover:underline">
                        Not sent. Tap to retry.
                      </button>
                    )}
                  </div>
                )
              )
            )}
            <div ref={endRef} />
          </div>

          <div className="p-4 border-t border-gray-100 flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={1000}
              placeholder="Type your message..."
              className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E4D34] text-sm text-gray-800 resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button
              onClick={() => send()}
              disabled={!text.trim()}
              className="bg-[#0E4D34] hover:bg-[#0A3021] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}