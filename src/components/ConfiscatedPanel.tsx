"use client";
import { useMemo, useState } from "react";

const PAGE_SIZE = 5;

export interface ConfiscatedItem {
  id: number;
  item_name: string;
  category: string;
  date_found: string | null;
  created_at: string;
  status: string;
  photo_url: string | null;
  student_name?: string | null;
  approx_time?: string | null;
  violation_notes?: string | null;
  admin?: { name: string } | null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export default function ConfiscatedPanel({
  items,
  onAdd,
  onView,
  onDelete,
}: {
  items: ConfiscatedItem[];
  onAdd: () => void;
  onView: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const sorted = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (!q) return sorted;
    return sorted.filter(
      (i) =>
        i.item_name.toLowerCase().includes(q) ||
        (i.category || "").toLowerCase().includes(q) ||
        (i.student_name || "").toLowerCase().includes(q) ||
        (i.admin?.name || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-gray-100">
        <div>
          <h2 className="font-black text-gray-700 text-lg">Confiscated Items</h2>
          <p className="text-gray-400 text-xs mt-0.5">School-confiscated property. Kept apart from lost and found records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search item, student, or admin..."
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4ADE80] text-sm text-gray-700"
          />
          <button
            type="button"
            onClick={onAdd}
            className="bg-[#0D5C3A] hover:bg-[#0A4A2E] text-white text-sm font-bold px-4 py-2 rounded-xl transition"
          >
            + Add Confiscated Item
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="font-bold text-lg">{items.length === 0 ? "No confiscated items yet" : "No matches"}</p>
          <p className="text-sm mt-1">
            {items.length === 0 ? "Items recorded under the Confiscated intake type appear here" : "Try a different search"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem]">
            <thead>
              <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-6 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Date Confiscated</th>
                <th className="px-4 py-3">Confiscated By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                        {i.photo_url ? (
                          <img src={i.photo_url} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-gray-300 text-[10px] font-bold">No photo</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-700 truncate">{i.item_name}</p>
                        {i.student_name ? <p className="text-xs text-gray-400 truncate">Student: {i.student_name}</p> : null}
                        {i.violation_notes ? <p className="text-xs text-gray-400 truncate max-w-[16rem]">{i.violation_notes}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{i.category}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(i.date_found || i.created_at)}
                    {i.approx_time ? <span className="block text-xs text-gray-400">{formatTime(i.approx_time)}</span> : null}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{i.admin?.name || "-"}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                      Confiscated
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button onClick={() => onView(i.id)} className="text-[#0D5C3A] hover:underline text-xs font-bold mr-4">View</button>
                    <button onClick={() => onDelete(i.id)} className="text-red-500 hover:underline text-xs font-bold">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-gray-400 text-xs">
            Showing {(safePage - 1) * PAGE_SIZE + 1}&ndash;{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-xs hover:border-[#0D5C3A] hover:text-[#0D5C3A] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500 font-bold">{safePage} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-xs hover:border-[#0D5C3A] hover:text-[#0D5C3A] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}