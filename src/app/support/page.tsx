"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";

const faqs = [
  { question: "How do I report a lost item?", answer: "Go to the Home page and click 'Report Lost Items'. Fill in the details and upload a clear photo of your item. Our AI will automatically search for potential matches among found items." },
  { question: "How do I report a found item?", answer: "Click 'Report Found Item' on the Home page. Fill in the details of where you found it and upload a photo. The item will be reviewed by the Guidance Counselor before being posted publicly." },
  { question: "How does the AI matching work?", answer: "Our AI uses image recognition to compare photos of lost and found items. When a potential match is found, both the student who lost the item and the admin are notified automatically." },
  { question: "How do I claim a found item?", answer: "If the AI finds a match for your lost report, you will receive a notification. You can then submit a claim by providing a written description of identifying features and a supporting photo. The admin will verify your claim through a 5-layer process." },
  { question: "What is a Trust Score?", answer: "Your Trust Score reflects your reliability in the FindNest system. It decreases when a claim you submitted is rejected. A low trust score may restrict your ability to submit new claims. Visit the school office if your account is restricted." },
  { question: "How long does the admin take to approve a found item?", answer: "The Guidance Counselor reviews found item reports as soon as the physical item is surrendered to the office. Once approved, the item will appear publicly in the found items list." },
  { question: "What happens if my claim is rejected?", answer: "If your claim is rejected, your Trust Score will decrease and you will be notified with the reason. You may appeal with new evidence. Repeated false claims may result in account restrictions." },
  { question: "How do I contact the Guidance Office?", answer: "You can visit the Guidance Office at SJDM Cornerstone College Inc. during school hours, or send an email to the contact below." },
];

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
  const [userInitial, setUserInitial] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch (err) {
      console.error("Error sending reply:", err);
    } finally {
      setReplySending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/support", {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      });
      setSubmitted(true);
      fetchMyMessages();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Failed to send message. Please try again."
      );
    } finally {
      setLoading(false);
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
          <a href="/support" className="text-[#1a237e] font-bold text-sm border-b-2 border-[#1a237e] pb-1">Support</a>
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
          <h1 className="text-3xl font-black text-[#1a237e]">Help & Support</h1>
          <p className="text-gray-400 text-sm mt-1">Find answers to common questions or contact the Guidance Office</p>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#1a237e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="font-black text-gray-700 text-sm">Visit Us</p>
            <p className="text-gray-400 text-xs mt-2 leading-relaxed">Guidance Office, SJDM Cornerstone College Inc., San Jose Del Monte, Bulacan</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#ffd700]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="font-black text-gray-700 text-sm">Email Us</p>
            <p className="text-gray-400 text-xs mt-2">findnest@sjdmcci.edu.ph</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-black text-gray-700 text-sm">Office Hours</p>
            <p className="text-gray-400 text-xs mt-2 leading-relaxed">Monday to Friday<br />8:00 AM — 5:00 PM</p>
          </div>
        </div>

        {!conversationsLoading && myMessages.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-6">
            <h2 className="text-xl font-black text-[#1a237e] mb-2">Your Conversations</h2>
            <p className="text-gray-400 text-sm mb-6">Messages you've sent and replies from the Guidance Office</p>

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

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-6">
          <h2 className="text-xl font-black text-[#1a237e] mb-6">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
                >
                  <p className="font-bold text-gray-700 text-sm pr-4">{faq.question}</p>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${openIndex === index ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openIndex === index && (
                  <div className="px-6 pb-4 border-t border-gray-100">
                    <p className="text-gray-500 text-sm leading-relaxed pt-3">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-black text-[#1a237e] mb-2">Send a Message</h2>
          <p className="text-gray-400 text-sm mb-6">Can't find what you're looking for? Send us a message and the Guidance Office will get back to you.</p>

          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-black text-gray-700 text-lg">Message Sent!</p>
              <p className="text-gray-400 text-sm mt-2">The Guidance Office will get back to you within 1-2 school days.</p>
              <button
                onClick={() => { setSubmitted(false); setName(""); setEmail(""); setMessage(""); setError(""); }}
                className="mt-6 bg-[#1a237e] hover:bg-[#283593] text-white font-bold px-8 py-3 rounded-xl transition"
              >
                Send Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your concern or question..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700 text-sm resize-none"
                  required
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm font-semibold">{error}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1a237e] hover:bg-[#283593] text-white font-black py-4 rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}