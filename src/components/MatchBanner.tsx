"use client";
import { useEffect, useState } from "react";

export interface MatchNotif {
  id: number;
  title: string;
  message: string;
  match_id?: number | null;
}

export default function MatchBanner({
  items,
  onView,
  onDismiss,
}: {
  items: MatchNotif[];
  onView: (n: MatchNotif) => void;
  onDismiss: (n: MatchNotif) => void;
}) {
  const [index, setIndex] = useState(0);

  // Keep the position valid when a match is dismissed
  useEffect(() => {
    if (index > items.length - 1) setIndex(Math.max(0, items.length - 1));
  }, [items.length, index]);

  if (items.length === 0) return null;

  const total = items.length;
  const current = items[Math.min(index, total - 1)];

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-4 mb-8 flex flex-wrap items-center justify-between gap-3 lg:mr-72">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-green-700 text-sm">
          {current.title}
          {total > 1 && <span className="ml-2 text-xs font-semibold text-green-600">({index + 1} of {total})</span>}
        </p>
        <p className="text-green-600 text-sm">{current.message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + total) % total)}
              aria-label="Previous match"
              className="w-7 h-7 rounded-full text-green-700 hover:bg-green-100 transition font-bold"
            >
              &lsaquo;
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % total)}
              aria-label="Next match"
              className="w-7 h-7 rounded-full text-green-700 hover:bg-green-100 transition font-bold"
            >
              &rsaquo;
            </button>
          </>
        )}
        <a
          href={current.match_id ? `/matched-item?matchId=${current.match_id}` : "/claim-status"}
          onClick={() => onView(current)}
          className="text-sm font-bold text-[#0E4D34] hover:underline"
        >
          View Match
        </a>
        <button
          type="button"
          onClick={() => onDismiss(current)}
          className="text-green-400 hover:text-green-600 transition font-bold text-sm px-2"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}