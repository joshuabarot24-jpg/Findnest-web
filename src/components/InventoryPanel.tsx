"use client";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

const PAGE_SIZE = 5;
const CATEGORIES = ["Office Supplies", "Cleaning Supplies", "Equipment", "Sports & PE Equipment", "Documents", "Others"];

type InvStatus = "in_stock" | "in_use" | "disposed";
type DateRange = "all" | "today" | "7d" | "10d" | "15d" | "30d";

interface InventoryItem {
  id: number;
  name: string;
  description: string | null;
  category: string;
  quantity: number;
  location: string | null;
  status: InvStatus;
  created_at: string;
  user?: { id: number; name: string } | null;
}

const STATUS: Record<InvStatus, { label: string; cls: string }> = {
  in_stock: { label: "In Stock", cls: "bg-green-50 text-green-700 border-green-200" },
  in_use: { label: "In Use", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  disposed: { label: "Disposed", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

function formatDate(value: string) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

const manilaDay = (ts: number) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

const selectCls =
  "px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold";

export default function InventoryPanel({
  addSignal = 0,
  onSwitchIntake,
}: {
  addSignal?: number;
  onSwitchIntake?: (type: "found_item" | "confiscated") => void;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [quantity, setQuantity] = useState("1");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<InvStatus>("in_stock");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // The page's top-right "+ Add Inventory Item" button raises this number
  useEffect(() => {
    if (addSignal > 0) openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal]);

  const fetchItems = async () => {
    try {
      const res = await api.get("/inventory");
      setItems(res.data.items || []);
    } catch (err) {
      console.error("Error fetching inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const todayKey = manilaDay(Date.now());
    const standard = CATEGORIES.filter((c) => c !== "Others");

    const list = items.filter((i) => {
      if (categoryFilter === "Others") {
        if (standard.includes(i.category)) return false;
      } else if (categoryFilter !== "all" && i.category !== categoryFilter) {
        return false;
      }

      if (dateRange !== "all") {
        const ts = new Date(i.created_at).getTime();
        if (dateRange === "today") {
          if (manilaDay(ts) !== todayKey) return false;
        } else {
          const days = { "7d": 7, "10d": 10, "15d": 15, "30d": 30 }[dateRange];
          if (ts < Date.now() - days * 24 * 60 * 60 * 1000) return false;
        }
      }

      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.location || "").toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === "oldest" ? diff : -diff;
    });
  }, [items, search, categoryFilter, dateRange, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const counts = useMemo(
    () => ({
      total: items.length,
      in_stock: items.filter((i) => i.status === "in_stock").length,
      in_use: items.filter((i) => i.status === "in_use").length,
      disposed: items.filter((i) => i.status === "disposed").length,
    }),
    [items]
  );

  function openAdd() {
    setEditing(null);
    setName("");
    setDescription("");
    setCategory(CATEGORIES[0]);
    setQuantity("1");
    setLocation("");
    setStatus("in_stock");
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditing(item);
    setName(item.name);
    setDescription(item.description || "");
    setCategory(item.category);
    setQuantity(String(item.quantity));
    setLocation(item.location || "");
    setStatus(item.status);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave() {
    const qty = Number(quantity);
    if (!/^[A-Za-z](?:.*[A-Za-z]){2}/.test(name.trim())) {
      setFormError("Item name must start with a letter and contain at least 3 letters.");
      return;
    }
    if (!location.trim()) {
      setFormError("Location is required.");
      return;
    }
    if (!/[A-Za-z]/.test(location)) {
      setFormError("Location must be a descriptive location (e.g., 'Shelf 1' or 'Main Office') and cannot be purely numbers.");
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setFormError("Quantity must be at least 1.");
      return;
    }
    setFormError("");
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      quantity: qty,
      location: location.trim() || null,
    };
    try {
      if (editing) {
        await api.put(`/inventory/${editing.id}`, payload);
        setToast("Inventory item updated.");
      } else {
        await api.post("/inventory", payload);
        setToast("Inventory item added.");
      }
      setModalOpen(false);
      fetchItems();
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Could not save the item. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/inventory/${deleting.id}`);
      setItems((prev) => prev.filter((i) => i.id !== deleting.id));
      setDeleting(null);
      setToast("Inventory item deleted.");
    } catch (err) {
      console.error("Error deleting inventory item:", err);
      setToast("Could not delete the item.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const inputCls =
    "w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-sm text-gray-800";

  return (
    <div>
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#1a237e] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: "Total Items", value: counts.total, color: "text-gray-700" },
          { label: "Total Units", value: items.reduce((n, i) => n + i.quantity, 0), color: "text-green-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-xs font-medium">{c.label}</p>
            <p className={`text-3xl font-black mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
          <div>
            <h2 className="font-black text-gray-700 text-lg">All Inventory Items</h2>
            <p className="text-gray-400 text-xs mt-0.5">Office stock and supplies. Separate from lost and found, matching, and claims.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={dateRange} onChange={(e) => { setDateRange(e.target.value as DateRange); setPage(1); }} className={selectCls}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="10d">Last 10 days</option>
              <option value="15d">Last 15 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as "newest" | "oldest"); setPage(1); }} className={selectCls}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, category, or location..."
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs w-56"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading inventory...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="font-bold text-lg">{items.length === 0 ? "No inventory items yet" : "No matches"}</p>
            <p className="text-sm mt-1">{items.length === 0 ? "Use + Add Inventory Item to log your first one" : "Try a different search or filter"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem]">
              <thead>
                <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Date Logged</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-700">{i.name}</p>
                      {i.description ? <p className="text-xs text-gray-400 truncate max-w-[18rem]">{i.description}</p> : null}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{i.category}</td>
                    <td className="px-4 py-4 text-sm font-bold text-gray-700">{i.quantity}</td>
                    <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">{formatDate(i.created_at)}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{i.location || "-"}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(i)}
                        className="bg-blue-50 hover:bg-[#1a237e] hover:text-white text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg transition mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleting(i)}
                        className="bg-red-50 hover:bg-red-500 hover:text-white text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg transition"
                      >
                        Delete
                      </button>
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
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-xs hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500 font-bold">{safePage} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-xs hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-black text-[#1a237e]">{editing ? "Edit Inventory Item" : "Add Inventory Item"}</h2>
              <button type="button" aria-label="Close" onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>

            {!editing && onSwitchIntake && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Intake Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setModalOpen(false); onSwitchIntake("found_item"); }}
                    className="py-2.5 rounded-xl text-xs font-bold border-2 border-gray-200 text-gray-400 hover:border-[#1a237e] hover:text-[#1a237e] transition"
                  >
                    Found Item
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModalOpen(false); onSwitchIntake("confiscated"); }}
                    className="py-2.5 rounded-xl text-xs font-bold border-2 border-gray-200 text-gray-400 hover:border-[#1a237e] hover:text-[#1a237e] transition"
                  >
                    Confiscated Item
                  </button>
                  <button
                    type="button"
                    className="py-2.5 rounded-xl text-xs font-bold border-2 border-[#1a237e] bg-blue-50 text-[#1a237e] cursor-default"
                  >
                    Inventory Item
                  </button>
                </div>
              </div>
            )}

            <fieldset disabled={saving} className="space-y-4 min-w-0 border-0 p-0 m-0">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Item Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bond paper, short" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional details" className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Quantity</label>
                  <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Location / Storage Room <span className="text-red-500">*</span></label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Guidance Stockroom, Shelf A" className={inputCls} />
              </div>
              {formError && (
                <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-semibold">{formError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">Cancel</button>
                <button type="button" onClick={handleSave} className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-2.5 rounded-xl transition text-sm disabled:opacity-50">
                  {saving ? "Saving..." : editing ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </fieldset>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4" onClick={() => setDeleting(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-[#1a237e] mb-2">Delete This Item?</h2>
            <p className="text-gray-500 text-sm mb-5">&quot;{deleting.name}&quot; will be removed from the inventory.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleting(null)} className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleteBusy} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition text-sm disabled:opacity-50">
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}