"use client";
// Admin > Item Management (/item-management). Found items + lost reports, add item, receipt, disposal.
// Lists show 5 rows per page (refreshes every 20s).
import { useState, useMemo, useEffect, useRef } from "react";
import ConfiscatedPanel from "@/components/ConfiscatedPanel";
import api from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import AuthGate from "@/components/AuthGate";
import AdminLayout from "@/components/AdminLayout";
import InventoryPanel from "@/components/InventoryPanel";
import { timeOptions } from "@/lib/reportTime";

// Must match the categories in InventoryPanel
const INVENTORY_CATEGORIES = ["Office Supplies", "Cleaning Supplies", "Equipment", "Sports & PE Equipment", "Documents", "Others"];
import { uploadErrorInfo } from "@/lib/uploadError";

interface OwnerResult {
  id: number;
  name: string;
  email: string;
  school_id: string | null;
}

// "21:07" becomes "9:07 PM"
function formatApproxTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// Keeps only letters, spaces, dots, apostrophes and hyphens
function filterLettersOnly(value: string) {
  return value.replace(/[^A-Za-z\s.'-]/g, "");
}

type ItemStatus = "unclaimed" | "claimed" | "for_disposal" | "disposed" | "confiscated" | "found_item" | "others" | "waiting_for_surrender" | "unsurrendered_expired";
type LostStatus = "searching" | "matched" | "returned";

interface FoundItem {
  id: number;
  item_name: string;
  category: string;
  location_found: string;
  storage_location: string;
  status: ItemStatus;
  photo_url: string | null;
  description: string | null;
  date_found: string | null;
  created_at: string;
  admin?: { name: string } | null;
  unclaimed_flagged_at?: string | null;
  needs_disposal_review?: boolean;
  disposal_notes?: string | null;
  disposed_at?: string | null;
  receipt_confirmed?: boolean;
  approx_time?: string | null;
  student_name?: string | null;
  violation_notes?: string | null;
  surrender_deadline?: string | null;
}

interface LostItem {
  id: number;
  item_name: string;
  category: string;
  location_lost: string;
  status: LostStatus;
  approx_time?: string | null;
  photo_url: string | null;
  description: string | null;
  date_lost: string | null;
  created_at: string;
  user?: { name: string; email: string } | null;
}

const CATEGORY_OPTIONS = [
  "Electronics", "Personal Belongings", "ID/Cards", "Keys",
  "School Supplies", "Accessories", "Books", "Vapes", "Others",
];

const PAGE_SIZE = 5;

// Add Item form: the four intake types and their selected colors
const INTAKE_TYPES = [
  { key: "found_item", label: "Found Item", active: "border-[#1a237e] bg-blue-50 text-[#1a237e]" },
  { key: "confiscated", label: "Confiscated Item", active: "border-[#1a237e] bg-blue-50 text-[#1a237e]" },
  { key: "inventory", label: "Inventory Item", active: "border-[#1a237e] bg-blue-50 text-[#1a237e]" },
] as const;

const TH = "text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider";

// Dot + badge + label per status
function statusStyles(status: string) {
  switch (status) {
    case "claimed": return { dot: "bg-green-500", badge: "bg-green-50 text-green-700", label: "Claimed" };
    case "unclaimed": return { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700", label: "Unclaimed" };
    case "confiscated": return { dot: "bg-purple-500", badge: "bg-purple-50 text-purple-700", label: "Confiscated" };
    case "others": return { dot: "bg-gray-500", badge: "bg-gray-100 text-gray-700", label: "Others" };
    case "waiting_for_surrender": return { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700", label: "Waiting for Surrender" };
    case "unsurrendered_expired": return { dot: "bg-gray-400", badge: "bg-gray-100 text-gray-500", label: "Post Discarded" };
    case "found_item": return { dot: "bg-teal-500", badge: "bg-teal-50 text-teal-700", label: "Found Item" };
    case "searching": return { dot: "bg-yellow-500", badge: "bg-yellow-50 text-yellow-700", label: "Searching" };
    case "matched": return { dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700", label: "Matched" };
    case "returned": return { dot: "bg-green-500", badge: "bg-green-50 text-green-700", label: "Returned" };
    case "disposed":
    case "for_disposal":
    default: return { dot: "bg-red-500", badge: "bg-red-50 text-red-600", label: "For Disposal" };
  }
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

// Photo thumbnail used in both tables
function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-contain" />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">N/A</div>
      )}
    </div>
  );
}

// Colored dot + status label
function StatusPill({ status }: { status: string }) {
  const s = statusStyles(status);
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${s.dot}`} />
      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap ${s.badge}`}>{s.label}</span>
    </div>
  );
}

// Label/value row used in the detail popups
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
      <span className="text-gray-400 font-medium">{label}</span>
      {children}
    </div>
  );
}

// Numbered pager: shows first, last and the pages next to the current one
function Pager({ page, pages, total, label, onChange }: { page: number; pages: number; total: number; label: string; onChange: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pages || Math.abs(p - page) <= 1
  );
  return (
    <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-3 items-center justify-between">
      <p className="text-gray-400 text-sm">Showing {from}&ndash;{to} of {total} {label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        {nums.map((p, idx) => (
          <span key={p} className="flex items-center gap-2">
            {idx > 0 && p - nums[idx - 1] > 1 && <span className="text-gray-300">&hellip;</span>}
            <button
              onClick={() => onChange(p)}
              className={
                p === page
                  ? "px-3 py-1.5 bg-[#1a237e] rounded-lg text-white text-sm font-bold"
                  : "px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition"
              }
            >
              {p}
            </button>
          </span>
        ))}
        <button
          onClick={() => onChange(Math.min(pages, page + 1))}
          disabled={page === pages}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-400 text-sm hover:border-[#1a237e] hover:text-[#1a237e] transition disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-400 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function ItemManagement() {
  return (
    <AuthGate allowedRole="admin">
      <ItemManagementContent />
    </AuthGate>
  );
}

function ItemManagementContent() {
 const [mainTab, setMainTab] = useState<"found" | "lost" | "aged" | "waiting" | "confiscated" | "inventory">("found");

  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [foundStatusFilter, setFoundStatusFilter] = useState("all");
  const [lostStatusFilter, setLostStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "10d" | "15d" | "30d">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingFoundItem, setViewingFoundItem] = useState<FoundItem | null>(null);
  const [viewingLostItem, setViewingLostItem] = useState<LostItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<FoundItem | null>(null);
  const [deleteAck, setDeleteAck] = useState(false);
  useEffect(() => {
    setDeleteAck(false);
  }, [deletingItem]);
  const [documentingDisposal, setDocumentingDisposal] = useState<FoundItem | null>(null);
  const [disposalNotes, setDisposalNotes] = useState("");
  const [disposalSubmitting, setDisposalSubmitting] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);

  // Add Item form
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState(CATEGORY_OPTIONS[0]);
  const [formLocationFound, setFormLocationFound] = useState("");
  const [formStorageLocation, setFormStorageLocation] = useState("");
  const [formDateFound, setFormDateFound] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIntakeType, setFormIntakeType] = useState<"confiscated" | "found_item" | "lost_item">("found_item");
  const [choosingItemUrl, setChoosingItemUrl] = useState<string | null>(null);
  const uploadCancelledRef = useRef(false);
  const [itemChoices, setItemChoices] = useState<string[]>([]);
  const [resolvingChoice, setResolvingChoice] = useState(false);

  // Manila-time date, N days back (used for the 3-day date window)
  function getManilaDate(daysAgo: number) {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  }

  const ALLOWED_DATES = [
    { value: getManilaDate(0), label: "Today" },
    { value: getManilaDate(1), label: "Yesterday" },
    { value: getManilaDate(2), label: "2 Days Ago" },
  ];
  const [formPhotoUrl, setFormPhotoUrl] = useState<string | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [formUploading, setFormUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [inventoryAddSignal, setInventoryAddSignal] = useState(0);
  const [inventoryRefresh, setInventoryRefresh] = useState(0);
  const [inventoryMode, setInventoryMode] = useState(false);
  const [invName, setInvName] = useState("");
  const [invDescription, setInvDescription] = useState("");
  const [invCategory, setInvCategory] = useState("Office Supplies");
  const [invQuantity, setInvQuantity] = useState("1");
  const [invLocation, setInvLocation] = useState("");
  const [invError, setInvError] = useState("");
  const [invSaving, setInvSaving] = useState(false);

  // Opens on the tab named in the address, for example /item-management?tab=aged from a Dashboard alert
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
  if (t === "found" || t === "lost" || t === "aged" || t === "waiting" || t === "confiscated" || t === "inventory") {
      setMainTab(t);
    }
  }, []);
  const [intakeTone, setIntakeTone] = useState<"red" | "amber">("red");
  const intakeErrorRef = useRef<HTMLDivElement>(null);

  // Whenever an upload error appears, bring it into view inside the modal
  useEffect(() => {
    if (intakeError) {
      intakeErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [intakeError]);
  const [formStudentName, setFormStudentName] = useState("");
  const [formViolationNotes, setFormViolationNotes] = useState("");
  const [formColor, setFormColor] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formOwner, setFormOwner] = useState<OwnerResult | null>(null);
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerResults, setOwnerResults] = useState<OwnerResult[]>([]);
  const [ownerSearching, setOwnerSearching] = useState(false);

  // Live student lookup while the admin types in the Student / Owner box
  useEffect(() => {
    const q = ownerQuery.trim();
    if (q.length < 2) {
      setOwnerResults([]);
      setOwnerSearching(false);
      return;
    }
    setOwnerSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/found-items/students/search", { params: { q } });
        setOwnerResults(res.data.students || []);
      } catch {
        setOwnerResults([]);
      } finally {
        setOwnerSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [ownerQuery]);
  const [formLoading, setFormLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Esc closes the removal window
  useEffect(() => {
    if (!deletingItem) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDeletingItem(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deletingItem]);

  // Locks page scroll while a popup is open
  useEffect(() => {
    const anyModalOpen = showAddModal || !!viewingFoundItem || !!viewingLostItem || !!deletingItem;
    if (anyModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }
  }, [showAddModal, viewingFoundItem, viewingLostItem, deletingItem]);

  const fetchFoundItems = async () => {
    try {
      const res = await api.get("/found-items");
      setFoundItems(res.data.records || []);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
      } else {
        console.error("Error fetching found items:", err);
      }
    }
  };

  const fetchLostItems = async () => {
    try {
      const res = await api.get("/lost-items");
      setLostItems(res.data.reports || []);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
      } else {
        console.error("Error fetching lost items:", err);
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchFoundItems(), fetchLostItems()]).finally(() => setLoading(false));
  }, []);

  useAutoRefresh(() => {
    fetchFoundItems();
    fetchLostItems();
  });

  useEffect(() => {
    setPage(1);
  }, [mainTab, search, categoryFilter, dateRange, sortOrder]);

  // Found items after status filter + search
    // [Filter] Category + date range (Manila time), shared by both tabs.
  // "Others" also matches any custom category a student typed in.
  const manilaDay = (ts: number) =>
    new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const todayKey = manilaDay(Date.now());
  const standardCategories = CATEGORY_OPTIONS.filter((c) => c !== "Others");
  const passesCategoryAndDate = (category: string, createdAt: string) => {
    if (categoryFilter === "Others") {
      if (standardCategories.includes(category)) return false;
    } else if (categoryFilter !== "all" && category !== categoryFilter) {
      return false;
    }
    if (dateRange === "all") return true;
    const ts = new Date(createdAt).getTime();
    if (dateRange === "today") return manilaDay(ts) === todayKey;
    const days = { "7d": 7, "10d": 10, "15d": 15, "30d": 30 }[dateRange];
    return ts >= Date.now() - days * 24 * 60 * 60 * 1000;
  };

  // Found items after status filter + search
  const filteredFound = useMemo(() => {
    const byStatus = foundItems.filter(
      (i) => i.status !== "confiscated" && (mainTab === "waiting" || i.receipt_confirmed !== false) && (foundStatusFilter === "all" || i.status === foundStatusFilter) && passesCategoryAndDate(i.category, i.created_at)
    );
    const q = search.toLowerCase().trim();
    if (!q) return byStatus;
    return byStatus.filter((i) => {
      const itmId = `itm-${String(i.id).padStart(3, "0")}`;
      const dateStr = new Date(i.created_at).toLocaleString().toLowerCase();
      return (
        i.item_name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.storage_location || "").toLowerCase().includes(q) ||
        (i.status || "").toLowerCase().includes(q) ||
        (i.admin?.name || "").toLowerCase().includes(q) ||
        itmId.includes(q) ||
        String(i.id).includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [foundItems, search, foundStatusFilter, categoryFilter, dateRange, mainTab]);

  // Lost reports after status filter + search
  const filteredLost = useMemo(() => {
    const byStatus = lostItems.filter(
      (i) => (lostStatusFilter === "all" || i.status === lostStatusFilter) && passesCategoryAndDate(i.category, i.created_at)
    );
    const q = search.toLowerCase().trim();
    if (!q) return byStatus;
    return byStatus.filter((i) => {
      const itmId = `lst-${String(i.id).padStart(3, "0")}`;
      const dateStr = new Date(i.created_at).toLocaleString().toLowerCase();
      return (
        i.item_name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.location_lost || "").toLowerCase().includes(q) ||
        (i.status || "").toLowerCase().includes(q) ||
        (i.user?.name || "").toLowerCase().includes(q) ||
        itmId.includes(q) ||
        String(i.id).includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [lostItems, search, lostStatusFilter, categoryFilter, dateRange]);

  // Aged items: flagged by the daily job (10+ days) or waiting for the 30-day disposal record
  // Reported by a student but not physically received yet
  const isWaiting = (i: FoundItem) =>
    i.status === "waiting_for_surrender" || (i.status === "unclaimed" && i.receipt_confirmed === false);
  const waitingItems = useMemo(() => foundItems.filter(isWaiting), [foundItems]);
  const isAged = (i: FoundItem) =>
    i.status === "unclaimed" && i.receipt_confirmed !== false && (!!i.needs_disposal_review || !!i.unclaimed_flagged_at);
  const agedItems = useMemo(
    () => foundItems.filter(isAged),
    [foundItems]
  );
  const filteredAged = useMemo(() => filteredFound.filter(isAged), [filteredFound]);
  const filteredWaiting = useMemo(() => filteredFound.filter(isWaiting), [filteredFound]);

  const activeFiltered = mainTab === "found" ? filteredFound : mainTab === "aged" ? filteredAged : mainTab === "waiting" ? filteredWaiting : filteredLost;
  const totalPages = Math.max(1, Math.ceil(activeFiltered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // Flagged unclaimed items float to the top of the found list
  const flagRank = (i: FoundItem) =>
    i.status !== "unclaimed" ? 2 : i.needs_disposal_review ? 0 : i.unclaimed_flagged_at ? 1 : 2;
  // [Sort] Strictly by logged time. Flagged items are handled in the Aged Items tab.
  const byTime = (a: { created_at: string }, b: { created_at: string }) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === "oldest" ? diff : -diff;
  };
  const sortedFound = [...filteredFound].sort(byTime);
  const sortedLost = [...filteredLost].sort(byTime);
  // Aged tab: disposal-review items first, then the rest, newest first inside each group
  const sortedAged = [...filteredAged].sort(byTime);
  const sortedWaiting = [...filteredWaiting].sort(byTime);
  const paginatedFound = (mainTab === "aged" ? sortedAged : mainTab === "waiting" ? sortedWaiting : sortedFound).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedLost = sortedLost.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const unclaimedCount = foundItems.filter((i) => i.status === "unclaimed").length;
  const claimedCount = foundItems.filter((i) => i.status === "claimed").length;
  const disposalCount = foundItems.filter((i) => i.status === "for_disposal" || i.status === "disposed").length;
  const searchingCount = lostItems.filter((i) => i.status === "searching").length;
  const matchedCount = lostItems.filter((i) => i.status === "matched").length;
  const returnedCount = lostItems.filter((i) => i.status === "returned").length;

  const statCards =
    mainTab === "found" || mainTab === "aged" || mainTab === "waiting"
      ? [
          { label: "Unclaimed Items", value: unclaimedCount, color: "text-[#1a237e]" },
          { label: "Claimed Items", value: claimedCount, color: "text-green-600" },
          { label: "For Disposal", value: disposalCount, color: "text-red-500" },
        ]
      : [
          { label: "Searching", value: searchingCount, color: "text-yellow-500" },
          { label: "Matched", value: matchedCount, color: "text-indigo-500" },
          { label: "Returned", value: returnedCount, color: "text-green-600" },
        ];

  function resetInventoryForm() {
    setInventoryMode(false);
    setInvName("");
    setInvDescription("");
    setInvCategory("Office Supplies");
    setInvQuantity("1");
    setInvLocation("");
    setInvError("");
    setInvSaving(false);
  }

  async function handleInventorySave() {
    const qty = Number(invQuantity);
    if (!/^(?=(?:.*[A-Za-z]){3})[A-Za-z][A-Za-z \-.,&()]*$/.test(invName.trim())) {
      setInvError("Item name can only contain letters (no numbers) and must have at least 3 letters.");
      return;
    }
    if (!invLocation.trim()) {
      setInvError("Location is required.");
      return;
    }
    if (!/[A-Za-z]/.test(invLocation)) {
      setInvError("Location must be a descriptive location (e.g., 'Shelf 1' or 'Main Office') and cannot be purely numbers.");
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setInvError("Quantity must be at least 1.");
      return;
    }
    setInvError("");
    setInvSaving(true);
    try {
      await api.post("/inventory", {
        name: invName.trim(),
        description: invDescription.trim() || null,
        category: invCategory,
        quantity: qty,
        location: invLocation.trim(),
      });
      setToast("Inventory item added.");
      setShowAddModal(false);
      resetInventoryForm();
      setInventoryRefresh((n) => n + 1);
    } catch (err: any) {
      setInvError(err.response?.data?.message || Object.values(err.response?.data?.errors || {}).flat().join(", ") || "Failed to add the inventory item.");
    } finally {
      setInvSaving(false);
    }
  }

  function resetForm() {
    resetInventoryForm();
    setFormName("");
    setFormCategory(CATEGORY_OPTIONS[0]);
    setFormLocationFound("");
    setFormStorageLocation("");
    setFormDateFound("");
    setFormDescription("");
    setFormIntakeType("found_item");
    setFormStudentName("");
    setFormViolationNotes("");
    setFormColor("");
    setFormBrand("");
    setFormTime("");
    setFormOwner(null);
    setOwnerQuery("");
    setOwnerResults([]);
    setFormPhotoUrl(null);
    setFormPhotoPreview(null);
    setFormError("");
    setFormUploading(false);
    setFormLoading(false);
  }

  // Uploads the photo and fills the form from the AI result
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadCancelledRef.current = false;
    setIntakeError("");
    setIntakeTone("red");
    setFormPhotoPreview(URL.createObjectURL(file));
    setFormUploading(true);
    setFormPhotoUrl(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("folder", "found-items");
      formData.append("analyze", "true");
      formData.append("intake_type", formIntakeType);
      const res = await api.post("/upload/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (uploadCancelledRef.current) return;
      setFormPhotoUrl(res.data.url);

      if (res.data.ai_item_name) setFormName(res.data.ai_item_name);
      if (res.data.ai_category) setFormCategory(res.data.ai_category);
      if (res.data.ai_description) setFormDescription(res.data.ai_description);
      // Colors and brand come back inside ai_details. Only fill them when the AI actually read something
      const aiColor = res.data.ai_details?.primary_color;
      const aiBrand = res.data.ai_details?.brand_or_markings;
      if (aiColor) setFormColor(aiColor);
      if (aiBrand) setFormBrand(aiBrand);
    } catch (err: any) {
      if (uploadCancelledRef.current) return;
      if (err.response?.status === 422 && err.response?.data?.multiple_items) {
        setFormPhotoUrl(err.response.data.url);
        setItemChoices(err.response.data.items_found || []);
        setChoosingItemUrl(err.response.data.url);
      } else if (err.response?.status === 422 && err.response?.data?.prohibited) {
        setFormPhotoPreview(null);
        setIntakeError(err.response.data.message || "This item can only be submitted under the 'Confiscated' intake type.");
        setIntakeTone("red");
      } else if (err.response?.status === 422) {
        console.error("Photo upload failed:", err);
        setFormPhotoPreview(null);
        { const info = uploadErrorInfo(err); setIntakeError(info.message); setIntakeTone(info.tone); }
      } else {
        console.error("Photo upload failed:", err);
        setFormPhotoPreview(null);
        setIntakeError(
          err.code === "ECONNABORTED" || !err.response
            ? "The upload took too long or the connection dropped. Please check your connection and try again."
            : "The photo could not be processed right now. Please try again, or use a different photo."
        );
      }
    } finally {
      if (!uploadCancelledRef.current) setFormUploading(false);
    }
  }

  // Multi-item photo: analyze only the item the admin picked
  async function handleChooseItem(choice: string) {
    if (!choosingItemUrl) return;
    setResolvingChoice(true);
    try {
      const res = await api.post("/upload/analyze-existing", {
        url: choosingItemUrl,
        item_hint: choice,
      });
      if (res.data.ai_item_name) setFormName(res.data.ai_item_name);
      if (res.data.ai_category) setFormCategory(res.data.ai_category);
      if (res.data.ai_description) setFormDescription(res.data.ai_description);
      if (res.data.ai_details?.primary_color) setFormColor(res.data.ai_details.primary_color);
      if (res.data.ai_details?.brand_or_markings) setFormBrand(res.data.ai_details.brand_or_markings);
    } catch (err) {
      console.error("Failed to analyze chosen item:", err);
    } finally {
      setChoosingItemUrl(null);
      setItemChoices([]);
      setResolvingChoice(false);
    }
  }

  // Saves a lost report or a found/confiscated item
  async function handleAddSubmit() {
    if (formIntakeType === "lost_item") {
      if (!formOwner) {
        setFormError("Choose the student who lost the item.");
        return;
      }
      if (formTime && !timeOptions(formDateFound).some((o) => o.value === formTime)) {
        setFormError("Choose a time between 6:00 AM and 7:00 PM that is not in the future.");
        return;
      }
      if (!formName.trim() || !formLocationFound.trim() || !formDateFound || !formPhotoUrl) {
        setFormError("Item name, location lost, date lost, and photo are required.");
        return;
      }
      setFormError("");
      setFormLoading(true);
      try {
        const lostRes = await api.post("/lost-items", {
          item_name: formName.trim(),
          category: formCategory,
          description: formDescription.trim() || null,
          ai_description: formDescription.trim() || null,
          location_lost: formLocationFound.trim(),
          date_lost: formDateFound,
          approx_time: formTime || null,
          primary_color: formColor.trim() || null,
          brand_model: formBrand.trim() || null,
          student_id: formOwner?.id,
          photo_url: formPhotoUrl,
        });
        const createdLost = lostRes.data?.report;
        setShowAddModal(false);
        resetForm();
        setPage(1);
        setToast(`${formName.trim()} was logged as a lost report.`);
        if (createdLost) {
          setLostItems((prev) => [{ ...createdLost, user: formOwner ? { name: formOwner.name, email: formOwner.email } : createdLost.user }, ...prev]);
        }
        fetchLostItems();
      } catch (err: any) {
        setFormError(err.response?.data?.message || Object.values(err.response?.data?.errors || {}).flat().join(", ") || "Failed to add report.");
      } finally {
        setFormLoading(false);
      }
      return;
    }

    if (formTime && !timeOptions(formDateFound).some((o) => o.value === formTime)) {
        setFormError("Choose a time between 6:00 AM and 7:00 PM that is not in the future.");
        return;
      }
      if (!formName.trim() || !formLocationFound.trim() || !formDateFound || !formPhotoUrl) {
      setFormError("Item name, location found, date found, and photo are required.");
      return;
    }
    setFormError("");
    setFormLoading(true);
    try {
      const foundRes = await api.post("/found-items", {
        item_name: formName.trim(),
        category: formCategory,
        description: formDescription.trim() || null,
        ai_description: formDescription.trim() || null,
        location_found: formLocationFound.trim(),
        date_found: formDateFound,
        approx_time: formTime || null,
        primary_color: formColor.trim() || null,
        brand_model: formBrand.trim() || null,
        photo_url: formPhotoUrl,
        storage_location: formStorageLocation.trim() || null,
        status: formIntakeType,
        student_name: formIntakeType === "confiscated" ? formStudentName.trim() || null : null,
        violation_notes: formIntakeType === "confiscated" ? formViolationNotes.trim() || null : null,
      });
      const createdFound = foundRes.data?.record;
      setShowAddModal(false);
      resetForm();
      setPage(1);
      setToast(`${formName.trim()} was added.`);
      window.dispatchEvent(new Event("findnest:counts-changed"));
      if (createdFound) setFoundItems((prev) => [createdFound, ...prev]);
      fetchFoundItems();
    } catch (err: any) {
      setFormError(err.response?.data?.message || Object.values(err.response?.data?.errors || {}).flat().join(", ") || "Failed to add item.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingItem) return;
    try {
      await api.delete(`/found-items/${deletingItem.id}`, { data: { confirmed: true } });
      setToast(`${deletingItem.item_name} was deleted.`);
      window.dispatchEvent(new Event("findnest:counts-changed"));
      setDeletingItem(null);
      setViewingFoundItem(null);
      fetchFoundItems();
    } catch (err) {
      console.error("Error deleting item:", err);
      setToast((err as any)?.response?.data?.message || "Could not remove the item.");
    }
  }

  // Admin confirms a student's found item was physically surrendered
  async function handleConfirmReceipt(item: FoundItem) {
    if (confirmingReceipt) return;
    setConfirmingReceipt(true);
    try {
      const res = await api.post(`/found-items/${item.id}/confirm-receipt`);
      // Update the row now, from the record the server returned
      const confirmed = res.data?.record;
      setFoundItems((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, ...(confirmed || {}), receipt_confirmed: true, surrender_deadline: null }
            : f
        )
      );
      setToast(`Receipt confirmed for ${item.item_name}. Matching is now active.`);
      setViewingFoundItem(null);
      window.dispatchEvent(new Event("findnest:counts-changed"));
      fetchFoundItems();
    } catch (err: any) {
      setToast(err.response?.data?.message || "Failed to confirm receipt.");
    } finally {
      setConfirmingReceipt(false);
    }
  }

  // Records how a 30-day unclaimed item was disposed of
  async function handleDocumentDisposal() {
    if (!documentingDisposal || !disposalNotes.trim()) return;
    setDisposalSubmitting(true);
    try {
      await api.post(`/found-items/${documentingDisposal.id}/document-disposal`, {
        disposal_notes: disposalNotes.trim(),
      });
      setToast(`Disposal documented for ${documentingDisposal.item_name}.`);
      setDocumentingDisposal(null);
      setDisposalNotes("");
      setViewingFoundItem(null);
      fetchFoundItems();
    } catch (err: any) {
      console.error("Error documenting disposal:", err);
      setToast("Could not save the disposal. Please try again.");
    } finally {
      setDisposalSubmitting(false);
    }
  }

  if (accessDenied) {
    return (
      <AdminLayout active="/item-management">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-gray-700 mb-2">Access Restricted</h1>
            <p className="text-gray-400 text-sm">
              Your account does not have permission to view Item Management. Contact the Super Admin if you believe this is a mistake.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active="/item-management">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#1a237e] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-[#06321C]">Item Management</h1>
          <p className="text-gray-400 text-sm mt-1">Review, approve and manage all lost and found item reports</p>
        </div>
        <button
          onClick={() => {
            if (mainTab === "inventory") {
              setInventoryAddSignal((n) => n + 1);
              return;
            }
            resetForm();
            if (mainTab === "confiscated") setFormIntakeType("confiscated");
            setShowAddModal(true);
          }}
          className={`flex items-center gap-2 bg-[#1a237e] hover:bg-[#283593] text-white font-bold px-6 py-3 rounded-2xl transition shadow-lg hover:-translate-y-0.5 transform ${mainTab === "lost" ? "hidden" : ""}`}
        >
          + Add Item
        </button>
      </div>

      {/* Found / Lost tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {([
          { key: "found", label: "Found Items Reports" },
          { key: "lost", label: "Lost Items Reports" },
          { key: "aged", label: "Aged Items (10+ Days)" },
          { key: "waiting", label: "Waiting for Surrender" },
          { key: "confiscated", label: "Confiscated Items" },
          { key: "inventory", label: "Others / Inventory" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              mainTab === t.key
                ? "bg-[#1a237e] text-white shadow-md"
                : "bg-white text-gray-500 border border-gray-200 hover:border-[#1a237e] hover:text-[#1a237e]"
            }`}
          >
            {t.label}
            {t.key === "waiting" && waitingItems.length > 0 && (
              <span className="ml-2 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-[#DC2626] text-white text-xs font-bold align-middle">
                {waitingItems.length > 99 ? "99+" : waitingItems.length}
              </span>
            )}
            {t.key === "aged" && agedItems.length > 0 && (
              <span className="ml-2 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-[#DC2626] text-white text-xs font-bold align-middle">
                {agedItems.length > 99 ? "99+" : agedItems.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Stat cards: 1 column on small screens, 3 from sm */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-6 mb-8 ${mainTab === "confiscated" || mainTab === "inventory" ? "hidden" : ""}`}>
        {statCards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">{c.label}</p>
            <p className={`text-4xl font-black mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {mainTab === "confiscated" && (
        <ConfiscatedPanel
          items={foundItems.filter((i) => i.status === "confiscated")}
          onView={(id) => { const f = foundItems.find((x) => x.id === id); if (f) setViewingFoundItem(f); }}
          onDelete={(id) => { const f = foundItems.find((x) => x.id === id); if (f) setDeletingItem(f); }}
        />
      )}
      {mainTab === "inventory" && (
        <InventoryPanel
          key={inventoryRefresh}
          addSignal={inventoryAddSignal}
          onSwitchIntake={(t) => {
            resetForm();
            setFormIntakeType(t);
            setMainTab(t === "confiscated" ? "confiscated" : "found");
            setShowAddModal(true);
          }}
        />
      )}

      {/* List card: 5 rows per page */}
      <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${mainTab === "confiscated" || mainTab === "inventory" ? "hidden" : ""}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
          <h2 className="font-black text-gray-700 text-lg">
            {mainTab === "found" ? "All Found Items" : mainTab === "aged" ? "Aged Items (10+ Days)" : mainTab === "waiting" ? "Waiting for Surrender" : "All Lost Item Reports"}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
          {mainTab === "found" || mainTab === "aged" || mainTab === "waiting" ? (
              <select
                value={foundStatusFilter}
                onChange={(e) => { setFoundStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="unclaimed">Unclaimed</option>
                <option value="claimed">Claimed</option>
                <option value="confiscated">Confiscated</option>
                <option value="others">Others</option>
                <option value="disposed">Disposed</option>
              </select>
            ) : (
              <select
                value={lostStatusFilter}
                onChange={(e) => { setLostStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="searching">Searching</option>
                <option value="matched">Matched</option>
                <option value="returned">Returned</option>
              </select>
            )}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
            >
              <option value="all">All Categories</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="10d">Last 10 Days</option>
              <option value="15d">Last 15 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-xs font-semibold"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <input
              type="text"
              placeholder="Search by name, category, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm w-full sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading items...</div>
        ) : mainTab === "found" || mainTab === "aged" || mainTab === "waiting" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Photo", "Item Name", "Category", "Storage Location", "Reported By", "Status", "Logged", "Actions"].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedFound.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4"><Thumb src={item.photo_url} alt={item.item_name} /></td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-700">{item.item_name}</p>
                      <p className="text-gray-400 text-xs mt-0.5">ID: ITM-{String(item.id).padStart(3, "0")}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-50 text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg">{item.category}</span>
                    </td>
                    <td className="px-6 py-4"><p className="text-gray-500 text-sm">{item.storage_location || "—"}</p></td>
                    <td className="px-6 py-4"><p className="text-gray-500 text-sm">{item.admin?.name || "—"}</p></td>
                    <td className="px-6 py-4"><StatusPill status={item.status} /></td>
                    <td className="px-6 py-4"><p className="text-gray-400 text-xs">{formatDateTime(item.created_at)}</p></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setViewingFoundItem(item)} className="bg-blue-50 hover:bg-[#1a237e] hover:text-white text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg transition">View</button>
                        {item.status === "unclaimed" && item.needs_disposal_review ? (
                          <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap">Document disposal</span>
                        ) : item.status === "unclaimed" && item.unclaimed_flagged_at ? (
                          <span className="bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap">Unclaimed 10+ days</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Photo", "Item Name", "Category", "Reported By", "Status", "Logged", "Actions"].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedLost.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4"><Thumb src={item.photo_url} alt={item.item_name} /></td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-700">{item.item_name}</p>
                      <p className="text-gray-400 text-xs mt-0.5">ID: LST-{String(item.id).padStart(3, "0")}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-50 text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg">{item.category}</span>
                    </td>
                    <td className="px-6 py-4"><p className="text-gray-500 text-sm">{item.user?.name || "—"}</p></td>
                    <td className="px-6 py-4"><StatusPill status={item.status} /></td>
                    <td className="px-6 py-4"><p className="text-gray-400 text-xs">{formatDateTime(item.created_at)}</p></td>
                    <td className="px-6 py-4">
                      <button onClick={() => setViewingLostItem(item)} className="bg-blue-50 hover:bg-[#1a237e] hover:text-white text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-lg transition">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && activeFiltered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="font-bold text-lg">No items found</p>
            <p className="text-sm mt-1">Try searching with a different keyword</p>
          </div>
        )}

        <Pager page={Math.min(page, totalPages)} pages={totalPages} total={activeFiltered.length} label="items" onChange={setPage} />
      </div>

      
      {/* Add Item */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md cursor-pointer"
          onClick={() => { uploadCancelledRef.current = true; setShowAddModal(false); resetForm(); }}
        >
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto cursor-default" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { uploadCancelledRef.current = true; setShowAddModal(false); resetForm(); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none">&times;</button>
            <h2 className="text-2xl font-black text-[#1a237e] mb-1">Add Item</h2>
            <p className="text-gray-400 text-sm mb-6">Record an item that was physically received by the office</p>
            {/* [UX] While the photo is being analyzed, every field is locked */}
            {formUploading && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
                <div className="w-5 h-5 border-4 border-blue-300 border-t-blue-500 rounded-full animate-spin shrink-0" />
                <p className="text-blue-700 text-sm font-semibold">Analyzing photo... please wait. The form is locked until it finishes.</p>
              </div>
            )}
            <fieldset disabled={formUploading} className="space-y-4 min-w-0 border-0 p-0 m-0">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Intake Type {!!formPhotoPreview && <span className="text-gray-400 font-normal normal-case">(locked after photo upload)</span>}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                  {INTAKE_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      disabled={!!formPhotoPreview}
                      onClick={() => {
                        if (t.key === "inventory") {
                          setInventoryMode(true);
                          setInvError("");
                          return;
                        }
                        setInventoryMode(false);
                        setFormIntakeType(t.key);
                        setIntakeError("");
                      }}
                      className={`py-3 rounded-xl text-sm font-bold border-2 transition ${(inventoryMode ? "inventory" : (formIntakeType as string)) === t.key ? t.active : "border-gray-200 text-gray-400"} ${!!formPhotoPreview ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {inventoryMode && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Item Name {!invName.trim() && <span className="text-red-500">*</span>}
                    </label>
                    <input type="text" value={invName} onChange={(e) => setInvName(e.target.value.replace(/[^A-Za-z \-.,&()]/g, ""))} placeholder="e.g. Bond paper, short" className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Category</label>
                      <select value={invCategory} onChange={(e) => setInvCategory(e.target.value)} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm">
                        {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        Quantity {!invQuantity && <span className="text-red-500">*</span>}
                      </label>
                      <input type="number" min={1} value={invQuantity} onChange={(e) => setInvQuantity(e.target.value)} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Location / Storage Room {!invLocation.trim() && <span className="text-red-500">*</span>}
                    </label>
                    <input type="text" value={invLocation} onChange={(e) => setInvLocation(e.target.value)} placeholder="e.g. Guidance Stockroom, Shelf A" className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Description (Optional)</label>
                    <textarea value={invDescription} onChange={(e) => setInvDescription(e.target.value)} placeholder="Optional details" rows={2} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm resize-none" />
                  </div>
                  {invError && <p className="text-red-500 text-xs font-semibold">{invError}</p>}
                </>
              )}
              <div className={inventoryMode ? "hidden" : "space-y-4"}>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Photo <span className="text-red-500">*</span></label>
                <label className="mt-1 block cursor-pointer">
                  <div className="border-2 border-dashed border-gray-200 hover:border-[#1a237e] rounded-xl p-4 text-center transition">
                    {formUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-4 border-blue-300 border-t-blue-500 rounded-full animate-spin" />
                        <p className="text-xs text-gray-500 font-bold">Analyzing photo...</p>
                      </div>
                    ) : formPhotoPreview ? (
                      <div>
                        <img src={formPhotoPreview} alt="Preview" className="max-h-32 mx-auto rounded-xl" />
                        {formPhotoUrl && <p className="text-green-600 text-xs font-bold mt-2">Uploaded successfully</p>}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-xs">Click to upload a photo</p>
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={formUploading} className="hidden" />
                </label>
                {intakeError && (
                  <div
                    ref={intakeErrorRef}
                    role="alert"
                    className={`mt-2 border rounded-lg px-3 py-2 text-xs font-semibold flex items-start justify-between gap-3 ${intakeTone === "amber" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-700"}`}
                  >
                    <span>{intakeError}</span>
                    <button type="button" aria-label="Dismiss" onClick={() => setIntakeError("")} className="font-bold leading-none opacity-70 hover:opacity-100">
                      &times;
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Item Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(filterLettersOnly(e.target.value))} placeholder="e.g. Grey Backpack" className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm" />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Category</label>
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm">
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {formIntakeType === "lost_item" && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Student / Owner</label>
                  {formOwner ? (
                    <div className="mt-1 flex items-center justify-between gap-3 px-4 py-3 border border-[#4ADE80] bg-[#E8F5E9] rounded-xl">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-700 truncate">{formOwner.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {formOwner.school_id ? `LRN ${formOwner.school_id} · ` : ""}{formOwner.email}
                        </p>
                      </div>
                      <button type="button" onClick={() => { setFormOwner(null); setOwnerQuery(""); }} className="text-xs font-bold text-red-500 hover:underline shrink-0">
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={ownerQuery}
                        onChange={(e) => setOwnerQuery(e.target.value)}
                        placeholder="Search name, email, or student ID..."
                        className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4ADE80] text-gray-700 text-sm"
                      />
                      {ownerQuery.trim().length >= 2 && (
                        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                          {ownerSearching ? (
                            <p className="text-gray-400 text-xs text-center py-4">Searching...</p>
                          ) : ownerResults.length === 0 ? (
                            <p className="text-gray-400 text-xs text-center py-4">No active student found.</p>
                          ) : (
                            ownerResults.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => { setFormOwner(s); setOwnerResults([]); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-[#E8F5E9] transition"
                              >
                                <p className="text-sm font-bold text-gray-700 truncate">{s.name}</p>
                                <p className="text-xs text-gray-400 truncate">{s.school_id ? `LRN ${s.school_id} · ` : ""}{s.email}</p>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {(formIntakeType === "lost_item" || formIntakeType === "found_item" || formIntakeType === "confiscated") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Primary Colors</label>
                    <input type="text" value={formColor} onChange={(e) => setFormColor(e.target.value)} placeholder="e.g. Black" className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4ADE80] text-gray-700 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Model and Brand</label>
                    <input type="text" value={formBrand} onChange={(e) => setFormBrand(e.target.value)} placeholder="e.g. Samsung A15" className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4ADE80] text-gray-700 text-sm" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {formIntakeType === "lost_item" ? "Approx. Time Lost" : formIntakeType === "confiscated" ? "Time Confiscated" : "Approx. Time Found"}
                </label>
                <select value={formTime} onChange={(e) => setFormTime(e.target.value)} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4ADE80] text-gray-700 text-sm">
                    <option value="">Select time (optional)</option>
                    {timeOptions(formDateFound).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {formDateFound && timeOptions(formDateFound).length === 0 && (
                    <p className="text-xs text-red-500 font-medium mt-1">No time is available yet today. Choose an earlier date.</p>
                  )}
              </div>
              {formIntakeType === "confiscated" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Student Name (if known)</label>
                    <input type="text" value={formStudentName} onChange={(e) => setFormStudentName(e.target.value)} placeholder="Optional" className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4ADE80] text-gray-700 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Violation Notes</label>
                    <textarea value={formViolationNotes} onChange={(e) => setFormViolationNotes(e.target.value)} rows={2} placeholder="e.g. Found inside the classroom during inspection" className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#4ADE80] text-gray-700 text-sm resize-none" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{formIntakeType === "lost_item" ? "Location Lost" : "Location Found"}</label>
                <input type="text" value={formLocationFound} onChange={(e) => setFormLocationFound(e.target.value)} placeholder={formIntakeType === "lost_item" ? "e.g. Room 305" : "e.g. Near the canteen"} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm" />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{formIntakeType === "lost_item" ? "Date Lost" : "Date Found"}</label>
                <input
                  type="date"
                  value={formDateFound}
                  onChange={(e) => { setFormDateFound(e.target.value); if (formTime && !timeOptions(e.target.value).some((o) => o.value === formTime)) setFormTime(""); }}
                  min={getManilaDate(21)}
                  max={ALLOWED_DATES[0].value}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm bg-gray-50"
                />
              </div>

              {formIntakeType !== "lost_item" && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Storage Location (Optional)</label>
                  <input type="text" value={formStorageLocation} onChange={(e) => setFormStorageLocation(e.target.value)} placeholder="e.g. Cabinet A-08" className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm" />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Description (Optional)</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Describe the item..." rows={2} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm resize-none" />
              </div>

              {formError && <p className="text-red-500 text-xs font-semibold">{formError}</p>}
              </div>
            </fieldset>

            <div className="flex gap-3 mt-8">
              <button onClick={() => { uploadCancelledRef.current = true; setShowAddModal(false); resetForm(); }} className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={inventoryMode ? handleInventorySave : handleAddSubmit}
                disabled={inventoryMode ? invSaving : formLoading || formUploading}
                className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                {(inventoryMode ? invSaving : formLoading) ? "Adding..." : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View found item */}
      {viewingFoundItem && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md cursor-pointer"
          onClick={() => setViewingFoundItem(null)}
        >
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setViewingFoundItem(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none">&times;</button>
            <div className="w-full rounded-2xl overflow-hidden bg-gray-100 mb-5 flex items-center justify-center">
              {viewingFoundItem.photo_url ? (
                <img src={viewingFoundItem.photo_url} alt={viewingFoundItem.item_name} className="w-full max-h-[50vh] object-contain" />
              ) : (
                <div className="text-gray-400 text-sm">No Photo Available</div>
              )}
            </div>
            <h2 className="text-xl font-black text-[#1a237e]">{viewingFoundItem.item_name}</h2>
            <p className="text-gray-400 text-xs mb-2">ID: ITM-{String(viewingFoundItem.id).padStart(3, "0")}</p>

            {viewingFoundItem.receipt_confirmed === false && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4">
                <p className="text-purple-700 text-xs font-bold">⏳ Awaiting Physical Surrender</p>
                <p className="text-purple-600 text-[11px] mt-0.5 mb-2">
                  Reported by a student, not yet confirmed received. Not visible for matching until confirmed.
                  {viewingFoundItem.surrender_deadline && (
                    <> Deadline: {formatDateTime(viewingFoundItem.surrender_deadline)}</>
                  )}
                </p>
              </div>
            )}

            {viewingFoundItem.unclaimed_flagged_at && viewingFoundItem.status === "unclaimed" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
                <p className="text-yellow-700 text-xs font-bold">⚠ Unclaimed for over 10 days</p>
                <p className="text-yellow-600 text-[11px] mt-0.5">Flagged {formatDateTime(viewingFoundItem.unclaimed_flagged_at)}</p>
              </div>
            )}

            {viewingFoundItem.needs_disposal_review && viewingFoundItem.status === "unclaimed" && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
                <p className="text-orange-700 text-xs font-bold">⚠ Reached 30-day disposal review threshold</p>
                <p className="text-orange-600 text-[11px] mt-0.5 mb-2">Please document how this item will be handled.</p>
                <button
                  onClick={() => { setDocumentingDisposal(viewingFoundItem); setDisposalNotes(""); }}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                >
                  Document Disposal
                </button>
              </div>
            )}

            {viewingFoundItem.disposal_notes && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <p className="text-gray-500 text-[10px] font-bold uppercase mb-1">Disposal Method Documented</p>
                <p className="text-gray-700 text-xs">{viewingFoundItem.disposal_notes}</p>
                {viewingFoundItem.disposed_at && (
                  <p className="text-gray-400 text-[10px] mt-1">{formatDateTime(viewingFoundItem.disposed_at)}</p>
                )}
              </div>
            )}

            <div className="space-y-3 text-sm">
             <DetailRow label="Category"><span className="font-bold text-gray-700 text-right">{viewingFoundItem.category}</span></DetailRow>
            {viewingFoundItem.status === "confiscated" ? (
              <>
                <DetailRow label="Confiscated From / Student Owner">
                  <span className="font-bold text-gray-700 text-right">
                    {viewingFoundItem.student_name ? `Student: ${viewingFoundItem.student_name}` : "Not recorded"}
                  </span>
                </DetailRow>
                {viewingFoundItem.violation_notes ? (
                  <DetailRow label="Violation Notes">
                    <span className="font-bold text-gray-700 text-xs text-right max-w-[14rem]">{viewingFoundItem.violation_notes}</span>
                  </DetailRow>
                ) : null}
              </>
            ) : null}
              <DetailRow label="Location Found"><span className="font-bold text-gray-700 text-right">{viewingFoundItem.location_found || "—"}</span></DetailRow>
              <DetailRow label="Storage Location"><span className="font-bold text-gray-700 text-right">{viewingFoundItem.storage_location || "—"}</span></DetailRow>
              <DetailRow label={viewingFoundItem.status === "confiscated" ? "Date Confiscated" : "Date Found"}><span className="font-bold text-gray-700 text-right">{viewingFoundItem.date_found || "—"}</span></DetailRow>
              <DetailRow label="Logged"><span className="font-bold text-gray-700 text-xs text-right">{formatDateTime(viewingFoundItem.created_at)}</span></DetailRow>
            {viewingFoundItem.approx_time ? (
              <DetailRow label="Approx. Time"><span className="font-bold text-gray-700 text-xs text-right">{formatApproxTime(viewingFoundItem.approx_time)}</span></DetailRow>
            ) : null}
              <DetailRow label="Status">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${statusStyles(viewingFoundItem.status).badge}`}>{statusStyles(viewingFoundItem.status).label}</span>
              </DetailRow>
              {viewingFoundItem.description && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium text-sm block mb-1">Description</span>
                  <span className="font-bold text-gray-700 text-sm">{viewingFoundItem.description}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeletingItem(viewingFoundItem)} className="flex-1 inline-flex items-center justify-center h-12 px-6 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 font-semibold text-sm tracking-wide leading-none antialiased rounded-xl transition-colors duration-200">Delete</button>
              {viewingFoundItem.receipt_confirmed === false ? (
                <button
                  onClick={() => handleConfirmReceipt(viewingFoundItem)}
                  disabled={confirmingReceipt}
                  className="flex-1 inline-flex items-center justify-center h-12 px-6 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white font-semibold text-sm tracking-wide leading-none antialiased rounded-xl shadow-sm transition-colors duration-200 disabled:opacity-50"
                >
                  {confirmingReceipt ? "Confirming..." : "Confirm Physical Receipt"}
                </button>
              ) : (
                <button onClick={() => setViewingFoundItem(null)} className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition">Close</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-item chooser */}
      {choosingItemUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-[#1a237e] mb-1">Multiple Items Detected</h2>
            <p className="text-gray-400 text-sm mb-6">We found several items in this photo. Which one is this?</p>

            {resolvingChoice ? (
              <div className="py-8 text-center">
                <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">Analyzing your selection...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {itemChoices.map((choice, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleChooseItem(choice)}
                    className="w-full text-left px-4 py-3 border-2 border-gray-200 hover:border-[#1a237e] hover:bg-blue-50 rounded-xl transition text-gray-700 font-semibold text-sm"
                  >
                    {choice}
                  </button>
                ))}
                <button
                  onClick={() => { setChoosingItemUrl(null); setItemChoices([]); }}
                  className="w-full text-center px-4 py-3 text-gray-400 hover:text-gray-600 text-sm font-semibold mt-2"
                >
                  None of these — I&apos;ll fill in details manually
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document disposal */}
      {documentingDisposal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-[#1a237e] mb-1">Document Disposal Method</h2>
            <p className="text-gray-400 text-sm mb-6">
              For &quot;{documentingDisposal.item_name}&quot; — this item has been unclaimed for over 30 days.
            </p>
            <label className="block text-sm font-bold text-gray-600 mb-2">Disposal Method</label>
            <textarea
              value={disposalNotes}
              onChange={(e) => setDisposalNotes(e.target.value)}
              placeholder="e.g. Donated to charity, discarded, returned to school inventory, given to PTA..."
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700 resize-none mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setDocumentingDisposal(null)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDocumentDisposal}
                disabled={disposalSubmitting || !disposalNotes.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                {disposalSubmitting ? "Saving..." : "Confirm Disposal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View lost report */}
      {viewingLostItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setViewingLostItem(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none">&times;</button>
            <div className="w-full rounded-2xl overflow-hidden bg-gray-100 mb-5 flex items-center justify-center">
              {viewingLostItem.photo_url ? (
              <img src={viewingLostItem.photo_url} alt={viewingLostItem.item_name} className="w-full max-h-[50vh] object-contain" />
              ) : (
                <div className="text-gray-400 text-sm">No Photo Available</div>
              )}
            </div>
            <h2 className="text-xl font-black text-[#1a237e]">{viewingLostItem.item_name}</h2>
            <p className="text-gray-400 text-xs mb-4">ID: LST-{String(viewingLostItem.id).padStart(3, "0")}</p>
            <div className="space-y-3 text-sm">
              <DetailRow label="Category"><span className="font-bold text-gray-700 text-right">{viewingLostItem.category}</span></DetailRow>
              <DetailRow label="Reported By"><span className="font-bold text-gray-700 text-right">{viewingLostItem.user?.name || "—"}</span></DetailRow>
              <DetailRow label="Location Lost"><span className="font-bold text-gray-700 text-right">{viewingLostItem.location_lost}</span></DetailRow>
              <DetailRow label="Date Lost"><span className="font-bold text-gray-700 text-right">{viewingLostItem.date_lost || "—"}</span></DetailRow>
              <DetailRow label="Logged"><span className="font-bold text-gray-700 text-xs text-right">{formatDateTime(viewingLostItem.created_at)}</span></DetailRow>
            {viewingLostItem.approx_time ? (
              <DetailRow label="Approx. Time"><span className="font-bold text-gray-700 text-xs text-right">{formatApproxTime(viewingLostItem.approx_time)}</span></DetailRow>
            ) : null}
              <DetailRow label="Status">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${statusStyles(viewingLostItem.status).badge}`}>{statusStyles(viewingLostItem.status).label}</span>
              </DetailRow>
              {viewingLostItem.description && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium text-sm block mb-1">Description</span>
                  <span className="font-bold text-gray-700 text-sm">{viewingLostItem.description}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setViewingLostItem(null)} className="w-full bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete found item */}
      {deletingItem && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md cursor-pointer"
          onClick={() => setDeletingItem(null)}
        >
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center max-h-[90vh] overflow-y-auto cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-red-50 p-3 rounded-2xl text-red-600 mb-3 w-fit mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 text-center mb-2">Confirm Item Removal</h2>
            <p className="text-gray-500 text-sm text-left leading-relaxed">You are about to remove this item from active Item Management:</p>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 my-3 text-center text-slate-800 font-bold text-sm break-words">
              {deletingItem.item_name}
            </div>
            <p className="text-gray-500 text-sm mb-4 text-left leading-relaxed">
              Please confirm that this deletion complies with guidance inventory policies. While an archived entry will be permanently preserved in the Digital Records for audit compliance, active tracking and public claim matching for this item will be terminated.
            </p>
            <label className="flex items-start gap-3 text-left bg-slate-50/60 p-3.5 rounded-xl border border-slate-100 my-4 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteAck}
                onChange={(e) => setDeleteAck(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-red-600"
              />
              <span className="text-xs text-slate-600 leading-relaxed font-medium">I confirm this deletion complies with institutional policies and acknowledge it will be archived in Digital Records.</span>
            </label>
            <div className="flex justify-end items-center gap-3">
              <button onClick={() => setDeletingItem(null)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-all">Cancel</button>
              <button
                onClick={handleDeleteConfirm}
                disabled={!deleteAck}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
