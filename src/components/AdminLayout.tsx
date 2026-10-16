"use client";
// [UI] Shared Admin shell: sidebar on lg+, slide-in menu below lg.
// Palette: canvas #F1F7F4, sidebar #0D3B29, active pill #D8E8DF, nav text #E2EFE9, profile card #C9DCD2.
// Icons: Lucide shapes drawn inline (no extra package).
import { useState, ReactNode } from "react";
import Link from "next/link";
import { logoutUser } from "@/lib/api";

// Each icon is a list of SVG elements in a 24x24 box (Lucide style: 2px round strokes)
const ICONS: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  package: (
    <>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="m7.5 4.27 9 5.15" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  archive: (
    <>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </>
  ),
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
};

function Icon({ name }: { name: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/item-management", label: "Item Management", icon: "package" },
  { href: "/claim-verification", label: "Claim Verification", icon: "check" },
  { href: "/location-analytics", label: "Location Analytics", icon: "pin" },
  { href: "/admin-user-management", label: "User Management", icon: "users" },
  { href: "/digital-records", label: "Digital Records", icon: "archive" },
  { href: "/admin-support", label: "Support Inbox", icon: "inbox" },
];

export default function AdminLayout({ active, children }: { active: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F1F7F4]">
      <div className="font-[family-name:var(--font-inter)] lg:hidden sticky top-0 z-40 flex items-center justify-between bg-[#0D3B29] px-4 py-3">
        <a href="/dashboard" className="text-[#E2EFE9] font-black text-lg">
          FIND<span className="text-[#ffd700]">NEST</span>
        </a>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-[#E2EFE9] text-2xl leading-none px-2">
          &#9776;
        </button>
      </div>

      {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />}

      <aside
        className={`font-[family-name:var(--font-inter)] fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#0D3B29] flex flex-col overflow-y-auto transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-start justify-between px-6 py-6">
          <div>
            <a href="/dashboard" className="text-[#E2EFE9] font-black text-lg block">
              FIND<span className="text-[#ffd700]">NEST</span>
            </a>
            <span className="text-[#E2EFE9]/70 text-xs">Admin Panel</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="lg:hidden text-[#E2EFE9] hover:text-white text-2xl leading-none">
            &times;
          </button>
        </div>

        <div className="mx-6 h-px bg-white/10 mb-4"></div>

        <nav className="flex flex-col gap-1 px-4 flex-1">
          <p className="text-[#E2EFE9]/60 text-xs font-bold uppercase tracking-wider px-4 mb-2">Main Menu</p>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${
                active === item.href
                  ? "bg-[#D8E8DF] text-[#0D3B29] font-semibold"
                  : "text-[#E2EFE9] hover:bg-white/10"
              }`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-4 py-6">
          <div className="bg-[#C9DCD2] rounded-2xl p-4 mb-4">
            <p className="text-[#1F2937] text-sm font-semibold">Guidance Counselor</p>
            <p className="text-[#4B6358] text-xs mt-1">Administrator</p>
          </div>
          <button
            onClick={logoutUser}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#E2EFE9] hover:bg-white/10 transition font-medium w-full text-left"
          >
            <Icon name="logout" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 lg:ml-72 p-4 sm:p-6 xl:p-8">{children}</main>
    </div>
  );
}