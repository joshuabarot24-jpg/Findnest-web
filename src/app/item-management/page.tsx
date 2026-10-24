"use client";
// Admin > Item Management (/item-management). Found items + lost reports, add item, receipt, disposal.
// Lists show 5 rows per page (refreshes every 20s).
import { useState, useMemo, useEffect, useRef } from "react";
import api from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import AuthGate from "@/components/AuthGate";
import AdminLayout from "@/components/AdminLayout";

// Keeps only letters, spaces, dots, apostrophes and hyphens
function filterLettersOnly(value: string) {
  return value.replace(/[^A-Za-z\s.'-]/g, "");
}

type ItemStatus = "unclaimed" | "claimed" | "for_disposal" | "disposed" | "confiscated" | "found_item" | "others";
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
  surrender_deadline?: string | null;
}

interface LostItem {
  id: number;
  item_name: string;
  category: string;
  location_lost: string;
  status: LostStatus;
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
  { key: "found_item", label: "Found Item", active: "border-teal-500 bg-teal-50 text-teal-700" },
  { key: "confiscated", label: "Confiscated", active: "border-purple-500 bg-purple-50 text-purple-700" },
  { key: "lost_item", label: "Lost Item", active: "border-red-500 bg-red-50 text-red-700" },
  { key: "others", label: "Others", active: "border-gray-500 bg-gray-100 text-gray-700" },
] as const;

const TH = "text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider";

// Dot + badge + label per status
function statusStyles(status: string) {
  switch (status) {
    case "claimed": return { dot: "bg-green-500", badge: "bg-green-50 text-green-700", label: "Claimed" };
    case "unclaimed": return { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700", label: "Unclaimed" };
    case "confiscated": return { dot: "bg-purple-500", badge: "bg-purple-50 text-purple-700", label: "Confiscated" };
    case "others": return { dot: "bg-gray-500", badge: "bg-gray-100 text-gray-700", label: "Others" };
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
  const [mainTab, setMainTab] = useState<"found" | "lost" | "aged">("found");

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
  const [formIntakeType, setFormIntakeType] = useState<"confiscated" | "found_item" | "lost_item" | "others">("found_item");
  const [formOthersSpecify, setFormOthersSpecify] = useState("");
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
  const [formLoading, setFormLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

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
      (i) => (foundStatusFilter === "all" || i.status === foundStatusFilter) && passesCategoryAndDate(i.category, i.created_at)
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
  }, [foundItems, search, foundStatusFilter, categoryFilter, dateRange]);

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
  const isAged = (i: FoundItem) =>
    i.status === "unclaimed" && (!!i.needs_disposal_review || !!i.unclaimed_flagged_at);
  const agedItems = useMemo(
    () => foundItems.filter(isAged),
    [foundItems]
  );
  const filteredAged = useMemo(() => filteredFound.filter(isAged), [filteredFound]);

  const activeFiltered = mainTab === "found" ? filteredFound : mainTab === "aged" ? filteredAged : filteredLost;
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
  const paginatedFound = (mainTab === "aged" ? sortedAged : sortedFound).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedLost = sortedLost.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const unclaimedCount = foundItems.filter((i) => i.status === "unclaimed").length;
  const claimedCount = foundItems.filter((i) => i.status === "claimed").length;
  const disposalCount = foundItems.filter((i) => i.status === "for_disposal" || i.status === "disposed").length;
  const searchingCount = lostItems.filter((i) => i.status === "searching").length;
  const matchedCount = lostItems.filter((i) => i.status === "matched").length;
  const returnedCount = lostItems.filter((i) => i.status === "returned").length;

  const statCards =
    mainTab === "found" || mainTab === "aged"
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

  function resetForm() {
    setFormName("");
    setFormCategory(CATEGORY_OPTIONS[0]);
    setFormLocationFound("");
    setFormStorageLocation("");
    setFormOthersSpecify("");
    setFormDateFound("");
    setFormDescription("");
    setFormIntakeType("found_item");
    setFormPhotoUrl(null);
    setFormPhotoPreview(null);
    setFormError("");
    setFormUploading(false);
    setFormLoading(false);
  }

  // Uploads the photo and fills the form from the AI result
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadCancelledRef.current = false;
    setIntakeError("");
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
    } catch (err: any) {
      if (uploadCancelledRef.current) return;
      if (err.response?.status === 422 && err.response?.data?.multiple_items) {
        setFormPhotoUrl(err.response.data.url);
        setItemChoices(err.response.data.items_found || []);
        setChoosingItemUrl(err.response.data.url);
      } else if (err.response?.status === 422 && err.response?.data?.prohibited) {
        setFormPhotoPreview(null);
        setIntakeError(err.response.data.message || "This item can only be submitted under the 'Confiscated' intake type.");
      } else if (err.response?.status === 422) {
        console.error("Photo upload failed:", err);
        setFormPhotoPreview(null);
        alert(err.response?.data?.message || "Photo upload failed. Please try again.");
      } else {
        console.error("Photo upload failed:", err);
        setFormPhotoPreview(null);
        alert("Photo upload failed. Please try again.");
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
    } catch (err) {
      console.error("Failed to analyze chosen item:", err);
    } finally {
      setChoosingItemUrl(null);
      setItemChoices([]);
      setResolvingChoice(false);
    }
  }

  // Saves a lost report or a found/confiscated/others item
  async function handleAddSubmit() {
    if (formIntakeType === "lost_item") {
      if (!formName.trim() || !formLocationFound.trim() || !formDateFound || !formPhotoUrl) {
        setFormError("Item name, location lost, date lost, and photo are required.");
        return;
      }
      setFormError("");
      setFormLoading(true);
      try {
        await api.post("/lost-items", {
          item_name: formName.trim(),
          category: formCategory,
          description: formDescription.trim() || null,
          ai_description: formDescription.trim() || null,
          location_lost: formLocationFound.trim(),
          date_lost: formDateFound,
          photo_url: formPhotoUrl,
        });
        setShowAddModal(false);
        resetForm();
        setPage(1);
        setToast(`${formName.trim()} was logged as a lost report.`);
        fetchLostItems();
      } catch (err: any) {
        setFormError(err.response?.data?.message || Object.values(err.response?.data?.errors || {}).flat().join(", ") || "Failed to add report.");
      } finally {
        setFormLoading(false);
      }
      return;
    }

    if (!formName.trim() || (formIntakeType !== "others" && !formLocationFound.trim()) || !formDateFound || !formPhotoUrl) {
      setFormError(formIntakeType === "others" ? "Item name, date, and photo are required." : "Item name, location found, date found, and photo are required.");
      return;
    }
    setFormError("");
    setFormLoading(true);
    try {
      await api.post("/found-items", {
        item_name: formName.trim(),
        category: formCategory,
        description: formDescription.trim() || null,
        ai_description: formDescription.trim() || null,
        location_found: formLocationFound.trim(),
        date_found: formDateFound,
        photo_url: formPhotoUrl,
        storage_location: formStorageLocation.trim() || null,
        status: formIntakeType,
      });
      setShowAddModal(false);
      resetForm();
      setPage(1);
      setToast(`${formName.trim()} was added.`);
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
      await api.delete(`/found-items/${deletingItem.id}`);
      setToast(`${deletingItem.item_name} was deleted.`);
      setDeletingItem(null);
      setViewingFoundItem(null);
      fetchFoundItems();
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  }

  // Admin confirms a student's found item was physically surrendered
  async function handleConfirmReceipt(item: FoundItem) {
    setConfirmingReceipt(true);
    try {
      await api.post(`/found-items/${item.id}/confirm-receipt`);
      setToast(`Receipt confirmed for ${item.item_name}. Matching is now active.`);
      setViewingFoundItem(null);
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
        {mainTab === "found" && (
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-[#1a237e] hover:bg-[#283593] text-white font-bold px-6 py-3 rounded-2xl transition shadow-lg hover:-translate-y-0.5 transform"
          >
            + Add Item
          </button>
        )}
      </div>

      {/* Found / Lost tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {([
          { key: "found", label: "Found Items Reports" },
          { key: "lost", label: "Lost Items Reports" },
          { key: "aged", label: "Aged Items (10+ Days)" },
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
            {t.key === "aged" && agedItems.length > 0 && (
              <span className="ml-2 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-[#DC2626] text-white text-xs font-bold align-middle">
                {agedItems.length > 99 ? "99+" : agedItems.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Stat cards: 1 column on small screens, 3 from sm */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-6 mb-8">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">{c.label}</p>
            <p className={`text-4xl font-black mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* List card: 5 rows per page */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
          <h2 className="font-black text-gray-700 text-lg">
            {mainTab === "found" ? "All Found Items" : mainTab === "aged" ? "Aged Items (10+ Days)" : "All Lost Item Reports"}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
          {mainTab === "found" || mainTab === "aged" ? (
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
        ) : mainTab === "found" || mainTab === "aged" ? (
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                  {INTAKE_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      disabled={!!formPhotoPreview}
                      onClick={() => { setFormIntakeType(t.key); setIntakeError(""); }}
                      className={`py-3 rounded-xl text-sm font-bold border-2 transition ${formIntakeType === t.key ? t.active : "border-gray-200 text-gray-400"} ${!!formPhotoPreview ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

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
                  {intakeError && (
                    <div role="alert" className="mt-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-semibold">
                      {intakeError}
                    </div>
                  )}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-xs">Click to upload a photo</p>
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={formUploading} className="hidden" />
                </label>
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

              {formIntakeType === "others" && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Please Specify (Optional)</label>
                  <input
                    type="text"
                    value={formOthersSpecify}
                    onChange={(e) => setFormOthersSpecify(e.target.value)}
                    placeholder="e.g. Classroom projector, office supplies"
                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm"
                  />
                </div>
              )}

              {formIntakeType !== "others" && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{formIntakeType === "lost_item" ? "Location Lost" : "Location Found"}</label>
                  <input type="text" value={formLocationFound} onChange={(e) => setFormLocationFound(e.target.value)} placeholder={formIntakeType === "lost_item" ? "e.g. Room 305" : "e.g. Near the canteen"} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-700 text-sm" />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{formIntakeType === "lost_item" ? "Date Lost" : "Date Found"}</label>
                <input
                  type="date"
                  value={formDateFound}
                  onChange={(e) => setFormDateFound(e.target.value)}
                  min={ALLOWED_DATES[2].value}
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
            </fieldset>

            <div className="flex gap-3 mt-8">
              <button onClick={() => { uploadCancelledRef.current = true; setShowAddModal(false); resetForm(); }} className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleAddSubmit} disabled={formLoading || formUploading} className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition disabled:opacity-50">
                {formLoading ? "Adding..." : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View found item */}
      {viewingFoundItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto">
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
                <button
                  onClick={() => handleConfirmReceipt(viewingFoundItem)}
                  disabled={confirmingReceipt}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  {confirmingReceipt ? "Confirming..." : "Confirm Physical Receipt"}
                </button>
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
              <DetailRow label="Location Found"><span className="font-bold text-gray-700 text-right">{viewingFoundItem.location_found || "—"}</span></DetailRow>
              <DetailRow label="Storage Location"><span className="font-bold text-gray-700 text-right">{viewingFoundItem.storage_location || "—"}</span></DetailRow>
              <DetailRow label="Date Found"><span className="font-bold text-gray-700 text-right">{viewingFoundItem.date_found || "—"}</span></DetailRow>
              <DetailRow label="Logged"><span className="font-bold text-gray-700 text-xs text-right">{formatDateTime(viewingFoundItem.created_at)}</span></DetailRow>
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
              <button onClick={() => setDeletingItem(viewingFoundItem)} className="flex-1 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 font-bold py-3 rounded-2xl transition">Delete</button>
              <button onClick={() => setViewingFoundItem(null)} className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition">Close</button>
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-[#1a237e] mb-2">Delete This Item?</h2>
            <p className="text-gray-400 text-sm mb-8">
              {deletingItem.item_name} will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingItem(null)} className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleDeleteConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
