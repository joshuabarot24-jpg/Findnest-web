"use client";
// [UI] Shared Super Admin shell: sidebar on lg+, slide-in menu below lg.
import { useState, ReactNode } from "react";
import Link from "next/link";
import { logoutUser } from "@/lib/api";

const NAV = [
  { href: "/user-management", label: "User Management" },
  { href: "/admin-management", label: "Admin Management" },
  { href: "/system-management", label: "System Management" },
  { href: "/super-admin-records", label: "Digital Records" },
];

export default function SuperAdminLayout({ active, children }: { active: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-[#1a237e] px-4 py-3">
        <a href="/user-management" className="text-white font-black text-lg">
          FIND<span className="text-[#ffd700]">NEST</span>
        </a>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-white text-2xl leading-none px-2">
          &#9776;
        </button>
      </div>

      {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#1a237e] flex flex-col overflow-y-auto transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-start justify-between px-6 py-6">
          <div>
            <a href="/user-management" className="text-white font-black text-lg block">
              FIND<span className="text-[#ffd700]">NEST</span>
            </a>
            <span className="text-blue-300 text-xs">Super Admin Panel</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="lg:hidden text-blue-200 hover:text-white text-2xl leading-none">
            &times;
          </button>
        </div>

        <div className="mx-6 h-px bg-white/10 mb-4"></div>

        <nav className="flex flex-col gap-1 px-4 flex-1">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-wider px-4 mb-2">Management</p>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${
                active === item.href
                  ? "bg-white/20 text-white font-semibold border border-white/20"
                  : "text-blue-200 hover:bg-white/10"
              }`}
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-4 py-6">
          <div className="bg-white/10 rounded-2xl p-4 mb-4">
            <p className="text-white text-sm font-semibold">Super Admin</p>
            <p className="text-blue-300 text-xs mt-1">System Administrator</p>
          </div>
          <button
            onClick={logoutUser}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium w-full text-left"
          >
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 lg:ml-72 p-4 sm:p-6 xl:p-8">{children}</main>
    </div>
  );
}