"use client";
// [UI] Shared Student shell: green sidebar (Home, Claim Status) + top header (bell dropdown, name, avatar menu).
import { useEffect, useRef, useState, ReactNode } from "react";
import Link from "next/link";
import api, { logoutUser } from "@/lib/api";
import { useUnreadCount } from "@/lib/useUnreadCount";

// Last loaded notification list, kept across page changes so the dropdown never opens empty
let cachedNotifs: Notif[] = [];
import StudentAvatar from "@/components/StudentAvatar";

const NAV = [
  { href: "/student-home", label: "Home", icon: "home" },
  { href: "/claim-status", label: "Claim Status", icon: "signal" },
];

interface Notif {
  id: number;
  title: string;
  message: string;
  type: string;
  match_id: number | null;
  is_read: boolean;
  created_at: string;
}

function Icon({ name }: { name: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      {name === "home" ? (
        <>
          <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
          <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </>
      ) : (
        <>
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
          <circle cx="12" cy="12" r="2" />
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
          <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
        </>
      )}
    </svg>
  );
}

export default function StudentLayout({
  active,
  children,
  hideHeader = false,
}: {
  active: string;
  children: ReactNode;
  hideHeader?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [name, setName] = useState("Student");
  const [email, setEmail] = useState("");
  const [notifs, setNotifs] = useState<Notif[]>(cachedNotifs);
  const [notifLoading, setNotifLoading] = useState(false);
  const { count } = useUnreadCount();
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("findnest_user") || "{}");
      if (u?.name) setName(u.name);
      if (u?.email) setEmail(u.email);
    } catch {}
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBell(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // [UX] Lock the page behind the slide-in menu while it is open (html + body)
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.touchAction = "";
    };
  }, [open]);

  const toggleBell = async () => {
    const next = !bell;
    setBell(next);
    setMenu(false);
    if (next) {
      // Only show the loading state when there is nothing cached to display
      if (cachedNotifs.length === 0) setNotifLoading(true);
      try {
        const res = await api.get("/notifications");
        cachedNotifs = res.data.notifications || [];
        setNotifs(cachedNotifs);
      } catch {}
      setNotifLoading(false);
    }
  };

  // While the dropdown is open, reload its list whenever the unread count changes
  useEffect(() => {
    if (!bell) return;
    api.get("/notifications").then((res) => {
      cachedNotifs = res.data.notifications || [];
      setNotifs(cachedNotifs);
    }).catch(() => {});
  }, [count, bell]);

  const unreadInList = notifs.filter((n) => !n.is_read).length;
  const shownNotifs = filter === "unread" ? notifs.filter((n) => !n.is_read) : notifs;

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifs((prev) => {
        const next = prev.map((x) => ({ ...x, is_read: true }));
        cachedNotifs = next;
        return next;
      });
      window.dispatchEvent(new Event("findnest:notifs-changed"));
    } catch {}
  };

  const openNotif = async (n: Notif) => {
    if (!n.is_read) {
      try {
        await api.post(`/notifications/${n.id}/read`);
      setNotifs((prev) => {
        const next = prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x));
        cachedNotifs = next;
        return next;
      });
        window.dispatchEvent(new Event("findnest:notifs-changed"));
      } catch {}
    }
    const t = (n.type || "").toLowerCase();
    if (t.includes("match") && n.match_id) window.location.href = `/matched-item?matchId=${n.match_id}`;
      else if (t === "override") window.location.href = "/notifications";
      else if (t === "unclaimed") window.location.href = "/student-home";
      else if (t.includes("status") || t.includes("claim") || t.includes("reminder")) window.location.href = "/claim-status";
    else window.location.href = "/notifications";
  };

  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);

  return (
    <div className="min-h-screen bg-[#EAF5EF]">
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 overscroll-contain"
          onClick={() => setOpen(false)}
          onWheel={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 max-w-[85vw] bg-[#0E4D34] flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-5 py-8">
          <Link
            href="/student-home"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2"
          >
            <img src="/images/findnest-logo.png" alt="FindNest" className="w-12 h-12 object-contain shrink-0" />
            <span className="text-white font-black text-2xl tracking-tight">FindNest</span>
          </Link>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="lg:hidden text-white text-2xl leading-none">&times;</button>
        </div>
        <nav className="flex flex-col gap-2 px-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-full font-semibold transition ${
                active === item.href ? "bg-white text-[#0E4D34]" : "text-white hover:bg-white/10"
              }`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="relative lg:ml-60 min-w-0 min-h-screen flex flex-col">
          <header className={`${hideHeader ? "lg:hidden" : ""} flex items-center justify-between lg:justify-end gap-4 px-4 sm:px-6 pt-5 pb-2 lg:absolute lg:top-0 lg:right-0 lg:z-40`}>
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="lg:hidden text-[#0E4D34] text-2xl leading-none">&#9776;</button>
          <div className="flex items-center gap-1 h-10">
            <div className="relative h-10 flex items-center" ref={bellRef}>
              <button onClick={toggleBell} className="relative w-10 h-10 flex items-center justify-center text-[#0E4D34]" aria-label="Notifications">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {count > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </button>
              <div
                aria-hidden={!bell}
                className={`absolute right-full top-0 mr-3 w-[22rem] sm:w-[28rem] max-w-[calc(100vw-5rem)] max-h-[min(340px,45vh)] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 origin-right transition-all duration-300 ease-out p-3 ${
                  bell
                    ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
                    : "opacity-0 translate-x-4 scale-95 pointer-events-none"
                }`}
              >
                <div className="px-3 pb-2 shrink-0">
                  <p className="font-black text-gray-700 text-sm">Notifications</p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setFilter("all")}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                          filter === "all" ? "bg-[#0E4D34] text-white" : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFilter("unread")}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                          filter === "unread" ? "bg-[#0E4D34] text-white" : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        Unread{unreadInList > 0 ? ` (${unreadInList})` : ""}
                      </button>
                    </div>
                    {unreadInList > 0 && (
                      <button onClick={markAllRead} className="text-xs font-bold text-[#0E4D34] hover:underline whitespace-nowrap">
                        Mark all as read
                      </button>
                    )}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain thin-scroll space-y-1">
                  {notifLoading ? (
                    <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>
                  ) : shownNotifs.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                    </div>
                  ) : (
                    shownNotifs.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => openNotif(n)}
                        className={`flex w-full items-center gap-2 text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition ${!n.is_read ? "bg-emerald-50/60" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate">
                            <span className="font-bold text-gray-700">{n.title}</span>
                            <span className="text-gray-500"> &middot; {n.message}</span>
                          </p>
                          <p className="text-gray-400 text-[10px] mt-0.5">{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                        {!n.is_read && <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />}
                      </button>
                    ))
                  )}
                </div>

                <Link
                  href="/notifications"
                  className="mt-2 shrink-0 block text-center py-2 rounded-xl text-xs font-bold text-[#0E4D34] hover:bg-gray-50 transition"
                >
                  View All Notifications
                </Link>
              </div>
            </div>

            <div className="relative h-10 flex items-center" ref={menuRef}>
              <button onClick={() => { setMenu((m) => !m); setBell(false); }} className="flex items-center gap-3">
                <span className="hidden sm:block text-sm font-semibold text-gray-700 max-w-[14rem] truncate leading-none">{name}</span>
                <span className="w-10 h-10 rounded-full overflow-hidden bg-[#0E4D34] text-white font-bold flex items-center justify-center">
                  <StudentAvatar name={name} />
                </span>
              </button>
              <div
                aria-hidden={!menu}
                className={`absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 origin-top overflow-hidden transition-all duration-300 ease-out ${
                  menu
                    ? "max-h-60 p-2 opacity-100 scale-y-100 pointer-events-auto"
                    : "max-h-0 p-0 opacity-0 scale-y-95 pointer-events-none border-transparent"
                }`}
              >
                  <p className="px-4 pt-2 pb-1 text-[11px] text-gray-400 truncate">{email}</p>
                  <Link href="/profile" className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">Profile</Link>
                  <Link href="/support" className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">Support</Link>
                  <div className="h-px bg-gray-100 my-1" />
                  <button onClick={logoutUser} className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50">Logout</button>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col px-4 sm:px-6 pb-6 lg:pt-5">{children}</main>
      </div>
    </div>
  );
}