"use client";
// [UI] Shared Super Admin shell: sidebar on lg+, slide-in menu below lg.
// Palette matches the Admin shell. Icons: Lucide shapes drawn inline (no extra package).
import { useState, ReactNode } from "react";
import Link from "next/link";
import { logoutUser } from "@/lib/api";

const ICONS: Record<string, ReactNode> = {
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  shield: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  folder: (
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
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
  { href: "/user-management", label: "User Management", icon: "users" },
  { href: "/admin-management", label: "Admin Management", icon: "shield" },
  { href: "/system-management", label: "System Management", icon: "settings" },
  { href: "/super-admin-records", label: "Digital Records", icon: "folder" },
];

export default function SuperAdminLayout({ active, children }: { active: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F1F7F4]">
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-[#0D3B29] px-4 py-3">
        <a href="/user-management" className="text-[#E2EFE9] font-black text-lg">
          FIND<span className="text-[#ffd700]">NEST</span>
        </a>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-[#E2EFE9] text-2xl leading-none px-2">
          &#9776;
        </button>
      </div>

      {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#0D3B29] flex flex-col overflow-y-auto transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-start justify-between px-6 py-6">
          <div>
            <a href="/user-management" className="text-[#E2EFE9] font-black text-lg block">
              FIND<span className="text-[#ffd700]">NEST</span>
            </a>
             <span className="text-[#E2EFE9]/70 text-xs">IT Coordinator Panel</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="lg:hidden text-[#E2EFE9] hover:text-white text-2xl leading-none">
            &times;
          </button>
        </div>

        <div className="mx-6 h-px bg-white/10 mb-4"></div>

        <nav className="flex flex-col gap-1 px-4 flex-1">
          <p className="text-[#E2EFE9]/60 text-xs font-bold uppercase tracking-wider px-4 mb-2">Management</p>
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
            <p className="text-[#1F2937] text-sm font-semibold">IT Coordinator</p>
            <p className="text-[#4B6358] text-xs mt-1">System Administrator</p>
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