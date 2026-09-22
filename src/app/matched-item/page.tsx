"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";

interface MatchDetail {
  id: number;
  confidence_score: number;
  matched_at: string;
  lost_item: {
    item_name: string;
    category: string;
    location_lost: string;
    date_lost: string;
  };
  found_item: {
    item_name: string;
    category: string;
    location_found: string;
    storage_location: string | null;
    photo_url: string | null;
    ai_description: string | null;
    date_found: string;
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MatchedItemPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = searchParams.get("matchId");

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [proofDescription, setProofDescription] = useState("");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [showClaimForm, setShowClaimForm] = useState(false);

  useEffect(() => {
    if (!matchId) {
      setError("No match specified.");
      setLoading(false);
      return;
    }

    const fetchMatch = async () => {
      try {
        const res = await api.get(`/ai-matches/${matchId}/reveal`);
        setMatch(res.data.match);
      } catch (err: any) {
        setError(err.response?.data?.message || "Could not load this match. It may no longer be available.");
      } finally {
        setLoading(false);
      }
    };
    fetchMatch();
  }, [matchId]);

  const handleSubmitClaim = async () => {
    if (!matchId) return;
    if (!proofDescription.trim()) {
      setClaimError("Please describe why you believe this item is yours.");
      return;
    }

    setClaimError("");
    setClaimSubmitting(true);
    try {
      await api.post("/claims", {
        match_id: Number(matchId),
        proof_description: proofDescription.trim(),
      });
      router.push("/claim-status");
    } catch (err: any) {
      setClaimError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat().join(", ") ||
          "Failed to submit claim. Please try again."
      );
    } finally {
      setClaimSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <a href="/student-home" className="flex items-center gap-3">
          <span className="text-lg font-black text-[#1a237e]">FIND<span className="text-[#ffd700]">NEST</span></span>
        </a>
        <div className="flex items-center gap-8">
          <a href="/student-home" className="text-gray-500 hover:text-[#1a237e] transition text-sm font-medium">Home</a>
          <a href="/claim-status" className="text-gray-500 hover:text-[#1a237e] transition text-sm font-medium">Claim Status</a>
        </div>
      </nav>

      <main className="px-8 py-10 max-w-2xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading your match...</div>
        ) : error ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 text-center">
            <p className="font-bold text-gray-700 text-lg mb-2">Can't View This Match</p>
            <p className="text-gray-400 text-sm mb-6">{error}</p>
            <a href="/claim-status" className="inline-block bg-[#1a237e] hover:bg-[#283593] text-white font-bold px-6 py-3 rounded-xl transition">
              Go to Claim Status
            </a>
          </div>
        ) : match ? (
          <>
            <div className="mb-6">
              <span className="inline-block bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                {match.confidence_score}% AI Confidence Match
              </span>
              <h1 className="text-2xl font-black text-[#1a237e]">Possible Match Found</h1>
              <p className="text-gray-400 text-sm mt-1">
                Our AI found this item that may match your lost report — take a look before claiming
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              <div className="w-full h-64 bg-gray-100">
                {match.found_item.photo_url ? (
                  <img src={match.found_item.photo_url} alt={match.found_item.item_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Photo Available</div>
                )}
              </div>
              <div className="p-6">
                <h2 className="text-xl font-black text-gray-700">{match.found_item.item_name}</h2>
                <p className="text-gray-400 text-sm mt-1">{match.found_item.category}</p>

                {match.found_item.ai_description && (
                  <p className="text-gray-600 text-sm mt-4 leading-relaxed">{match.found_item.ai_description}</p>
                )}

                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-400 font-medium">Found At</span>
                    <span className="font-bold text-gray-700">{match.found_item.location_found}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-400 font-medium">Date Found</span>
                    <span className="font-bold text-gray-700">{formatDate(match.found_item.date_found)}</span>
                  </div>
                  {match.found_item.storage_location && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="text-gray-400 font-medium">Currently Stored At</span>
                      <span className="font-bold text-gray-700">{match.found_item.storage_location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
              <p className="text-blue-700 text-xs leading-relaxed">
                Your lost report was: <strong>{match.lost_item.item_name}</strong>, last seen at {match.lost_item.location_lost} on {formatDate(match.lost_item.date_lost)}.
              </p>
            </div>

            {!showClaimForm ? (
              <div className="flex gap-3">
                <a
                  href="/claim-status"
                  className="flex-1 border-2 border-gray-200 text-gray-500 hover:bg-gray-50 font-bold py-3.5 rounded-xl transition text-center"
                >
                  Not Mine
                </a>
                <button
                  onClick={() => setShowClaimForm(true)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3.5 rounded-xl transition"
                >
                  This Is Mine — Claim It
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <label className="block text-sm font-bold text-gray-600 mb-2">Your Description</label>
                <p className="text-gray-400 text-xs mb-3">
                  Describe specific details only the true owner would know. You'll also answer a few verification questions after submitting.
                </p>
                <textarea
                  value={proofDescription}
                  onChange={(e) => setProofDescription(e.target.value)}
                  placeholder="Describe why you believe this item belongs to you..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#1a237e] focus:outline-none transition text-gray-700 resize-none mb-4"
                />

                {claimError && (
                  <p className="text-red-500 text-xs font-semibold mb-4">{claimError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClaimForm(false)}
                    className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-xl transition hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmitClaim}
                    disabled={claimSubmitting}
                    className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white font-black py-3 rounded-xl transition disabled:opacity-50"
                  >
                    {claimSubmitting ? "Submitting..." : "Submit Claim"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}