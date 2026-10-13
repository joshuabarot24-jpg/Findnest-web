"use client";
// Read-only overview of a student's postings (lost reports, found reports, claims).
// Click a row to see the full details. Used by the Admin and Super Admin User Management pages.
import { useEffect, useState } from "react";
import api from "@/lib/api";

interface ActivityData {
  student: { id: number; name: string };
  lost_reports: any[];
  found_reports: any[];
  claims: any[];
}

type Tab = "lost" | "found" | "claims";
type Selected = { kind: Tab; item: any } | null;

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (["approved", "returned", "claimed"].includes(s)) return "bg-green-50 text-green-700";
  if (["rejected", "disposed", "abandoned"].includes(s)) return "bg-red-50 text-red-600";
  if (["matched", "pending"].includes(s)) return "bg-yellow-50 text-yellow-700";
  return "bg-blue-50 text-blue-700";
}

// Small thumbnail with a fallback
function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span className="text-gray-400 text-[10px] font-bold">N/A</span>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl">
      <span className="text-gray-400 font-medium text-sm">{label}</span>
      <span className="font-bold text-gray-700 text-sm text-right break-words">{value || "—"}</span>
    </div>
  );
}

export default function StudentActivityModal({
  studentId,
  studentName,
  onClose,
}: {
  studentId: number;
  studentName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("lost");
  const [selected, setSelected] = useState<Selected>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/users/${studentId}/activity`);
        if (!cancelled) setData(res.data);
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.message || "Could not load this student's postings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "lost", label: "Lost Reports", count: data?.lost_reports.length ?? 0 },
    { key: "found", label: "Found Reports", count: data?.found_reports.length ?? 0 },
    { key: "claims", label: "Claims", count: data?.claims.length ?? 0 },
  ];

  const list = !data ? [] : tab === "lost" ? data.lost_reports : tab === "found" ? data.found_reports : data.claims;

  // One overview row for each kind of item
  function overview(item: any) {
    if (tab === "claims") {
      const found = item.match?.found_record;
      const lost = item.match?.lost_report;
      return {
        photo: found?.photo_url || lost?.photo_url,
        title: found?.item_name || lost?.item_name || "Claim",
        sub: `Claim submitted ${fmt(item.created_at)}`,
        status: item.collected_at ? "collected" : item.claim_status,
      };
    }
    if (tab === "found") {
      return { photo: item.photo_url, title: item.item_name, sub: `Found at ${item.location_found || "—"} · ${fmt(item.created_at)}`, status: item.status };
    }
    return { photo: item.photo_url, title: item.item_name, sub: `Lost at ${item.location_lost || "—"} · ${fmt(item.created_at)}`, status: item.status };
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none">&times;</button>

        {selected ? (
          // Full details of one posting
          <div>
            <button onClick={() => setSelected(null)} className="text-[#1a237e] text-sm font-bold hover:underline mb-4">&larr; Back to list</button>
            {(() => {
              const it = selected.item;
              if (selected.kind === "claims") {
                const found = it.match?.found_record;
                const lost = it.match?.lost_report;
                return (
                  <div className="space-y-3">
                    <h2 className="text-xl font-black text-[#1a237e]">Claim for {found?.item_name || lost?.item_name || "item"}</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {found?.photo_url && <img src={found.photo_url} alt="Found item" className="w-full aspect-square object-cover rounded-2xl" />}
                      {it.proof_photo_url && <img src={it.proof_photo_url} alt="Claim evidence" className="w-full aspect-square object-cover rounded-2xl" />}
                    </div>
                    <Row label="Status" value={<span className={`text-xs font-bold px-2 py-1 rounded-lg ${statusBadge(it.collected_at ? "collected" : it.claim_status)}`}>{(it.collected_at ? "collected" : it.claim_status || "").toUpperCase()}</span>} />
                    <Row label="Submitted" value={fmt(it.created_at)} />
                    <Row label="AI score" value={it.match?.confidence_score != null ? `${it.match.confidence_score}%` : "—"} />
                    <Row label="Photo similarity" value={it.photo_similarity_score != null ? `${it.photo_similarity_score}%` : "—"} />
                    <Row label="Collected" value={it.collected_at ? fmt(it.collected_at) : "Not collected"} />
                    {it.proof_description && (
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-gray-400 font-medium text-sm mb-1">Written description</p>
                        <p className="text-gray-700 text-sm">{it.proof_description}</p>
                      </div>
                    )}
                    {it.admin_notes && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-red-400 text-xs font-bold uppercase mb-1">Admin notes</p>
                        <p className="text-red-700 text-sm">{it.admin_notes}</p>
                      </div>
                    )}
                  </div>
                );
              }
              const isFound = selected.kind === "found";
              return (
                <div className="space-y-3">
                  <h2 className="text-xl font-black text-[#1a237e]">{it.item_name}</h2>
                  {it.photo_url && <img src={it.photo_url} alt={it.item_name} className="w-full max-h-64 object-cover rounded-2xl" />}
                  <Row label="Status" value={<span className={`text-xs font-bold px-2 py-1 rounded-lg ${statusBadge(it.status)}`}>{(it.status || "").toUpperCase()}</span>} />
                  <Row label="Category" value={it.category} />
                  <Row label={isFound ? "Location found" : "Location lost"} value={isFound ? it.location_found : it.location_lost} />
                  <Row label={isFound ? "Date found" : "Date lost"} value={isFound ? it.date_found : it.date_lost} />
                  <Row label="Posted" value={fmt(it.created_at)} />
                  {isFound && <Row label="Storage location" value={it.storage_location} />}
                  {(it.ai_description || it.description) && (
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <p className="text-gray-400 font-medium text-sm mb-1">Description</p>
                      <p className="text-gray-700 text-sm">{it.ai_description || it.description}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          // Overview lists
          <>
            <h2 className="text-2xl font-black text-[#1a237e] mb-1">{studentName}&apos;s postings</h2>
            <p className="text-gray-400 text-sm mb-5">Read-only overview. Click a row to see the full details.</p>

            <div className="flex flex-wrap gap-2 mb-4">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    tab === t.key ? "bg-[#1a237e] text-white" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#1a237e]"
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-gray-400 text-sm text-center py-10">Loading...</p>
            ) : error ? (
              <p className="text-red-500 text-sm text-center py-10">{error}</p>
            ) : list.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">Nothing here yet.</p>
            ) : (
              <div className="space-y-2">
                {list.map((item: any) => {
                  const o = overview(item);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelected({ kind: tab, item })}
                      className="w-full flex items-center gap-3 p-3 border border-gray-100 rounded-2xl hover:bg-gray-50 transition text-left"
                    >
                      <Thumb src={o.photo} alt={o.title} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-700 text-sm truncate">{o.title}</p>
                        <p className="text-gray-400 text-xs truncate">{o.sub}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap ${statusBadge(o.status)}`}>
                        {(o.status || "").toString().toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <button onClick={onClose} className="w-full mt-6 bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-2xl transition">Close</button>
          </>
        )}
      </div>
    </div>
  );
}