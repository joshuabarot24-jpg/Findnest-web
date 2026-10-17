"use client";
// Student > Matched Item (/matched-item?matchId=). Reveals a possible match and lets the student claim it.
// API: /ai-matches/{id}/reveal, /upload/image, /claims
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import StudentLayout from "@/components/StudentLayout";

interface MatchDetail {
  id: number;
  confidence_score: number;
  matched_at: string;
  lost_item: { item_name: string; category: string; location_lost: string; date_lost: string };
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
  return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
  const [claimPhotos, setClaimPhotos] = useState<{ preview: string; url: string | null; uploading: boolean }[]>([]);
  const CLAIM_MAX_PHOTOS = 1;

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

  const claimUploadedUrls = claimPhotos.filter((p) => p.url).map((p) => p.url as string);
  const claimAnyUploading = claimPhotos.some((p) => p.uploading);

  const handleClaimPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const filesToAdd = files.slice(0, CLAIM_MAX_PHOTOS - claimPhotos.length);
    if (filesToAdd.length === 0) return;

    const startIndex = claimPhotos.length;
    const newEntries = filesToAdd.map((file) => ({
      preview: URL.createObjectURL(file),
      url: null as string | null,
      uploading: true,
    }));
    setClaimPhotos((prev) => [...prev, ...newEntries]);

    for (let i = 0; i < filesToAdd.length; i++) {
      const idx = startIndex + i;
      try {
        const formData = new FormData();
        formData.append("image", filesToAdd[i]);
        formData.append("folder", "appeal-evidence");
        formData.append("analyze", "false");
        const res = await api.post("/upload/image", formData, { headers: { "Content-Type": "multipart/form-data" } });
        setClaimPhotos((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], url: res.data.url, uploading: false };
          return next;
        });
      } catch (err: any) {
        console.error("Claim photo upload failed:", err);
        setClaimPhotos((prev) => prev.filter((_, i2) => i2 !== idx));
        setClaimError(err.response?.data?.message || "One of your photos failed to upload. Please try again.");
      }
    }
    e.target.value = "";
  };

  const removeClaimPhoto = (index: number) => setClaimPhotos((prev) => prev.filter((_, i) => i !== index));

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
        proof_photo_url: claimUploadedUrls[0] || null,
        proof_photo_urls: claimUploadedUrls,
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

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#F3FAF6] rounded-xl">
      <span className="text-gray-500 font-medium text-sm">{label}</span>
      <span className="font-bold text-gray-800 text-sm">{value}</span>
    </div>
  );

  return (
    <StudentLayout active="/claim-status" hideHeader>
      <div className="w-full max-w-3xl">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading your match...</div>
        ) : error ? (
          <div className="bg-white rounded-3xl border border-[#D9E8DF] shadow-sm p-10 text-center">
            <p className="font-bold text-gray-800 text-lg mb-2">Can&apos;t View This Match</p>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <a href="/claim-status" className="inline-block bg-[#0E4D34] hover:bg-[#0A3021] text-white font-bold px-6 py-3 rounded-full transition">
              Go to Claim Status
            </a>
          </div>
        ) : match ? (
          <>
            <div className="mb-6">
              <span className="inline-block bg-[#B9CBBF] text-[#0A2618] text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                {match.confidence_score}% AI Confidence Match
              </span>
              <h1 className="text-2xl font-black text-[#0E4D34]">Possible Match Found</h1>
              <p className="text-gray-500 text-sm mt-1">
                Our AI found this item that may match your lost report. Take a look before claiming.
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-[#D9E8DF] shadow-sm overflow-hidden mb-6">
              <div className="w-full bg-gray-100 flex items-center justify-center">
                {match.found_item.photo_url ? (
                  <img src={match.found_item.photo_url} alt={match.found_item.item_name} className="w-full max-h-[60vh] object-contain" />
                ) : (
                  <div className="py-24 text-gray-400 text-sm">No Photo Available</div>
                )}
              </div>
              <div className="p-6">
                <h2 className="text-xl font-black text-gray-800">{match.found_item.item_name}</h2>
                <p className="text-gray-500 text-sm mt-1">{match.found_item.category}</p>
                {match.found_item.ai_description && (
                  <p className="text-gray-600 text-sm mt-4 leading-relaxed">{match.found_item.ai_description}</p>
                )}
                <div className="mt-5 space-y-2">
                  <Row label="Found At" value={match.found_item.location_found} />
                  <Row label="Date Found" value={formatDate(match.found_item.date_found)} />
                  {match.found_item.storage_location && <Row label="Currently Stored At" value={match.found_item.storage_location} />}
                </div>
              </div>
            </div>

            <div className="bg-[#E3EEE7] border border-[#B9CBBF] rounded-2xl p-4 mb-6">
              <p className="text-[#1E3F2E] text-xs leading-relaxed">
                Your lost report was: <strong>{match.lost_item.item_name}</strong>, last seen at {match.lost_item.location_lost} on {formatDate(match.lost_item.date_lost)}.
              </p>
            </div>

            {!showClaimForm ? (
              <div className="flex gap-3">
                <a href="/claim-status" className="flex-1 border-2 border-gray-300 text-gray-600 hover:bg-white font-bold py-3.5 rounded-full transition text-center">
                  Not Mine
                </a>
                <button onClick={() => setShowClaimForm(true)} className="flex-1 bg-[#0E4D34] hover:bg-[#0A3021] text-white font-black py-3.5 rounded-full transition">
                  This Is Mine: Claim It
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-[#D9E8DF] shadow-sm p-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Your Description</label>
                <p className="text-gray-500 text-xs mb-3">
                  Describe specific details only the true owner would know. You&apos;ll also answer a few verification questions after submitting.
                </p>
                <textarea
                  value={proofDescription}
                  onChange={(e) => setProofDescription(e.target.value)}
                  placeholder="Describe why you believe this item belongs to you..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#0E4D34] focus:outline-none transition text-gray-700 resize-none mb-4"
                />

                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Evidence Photos (Optional)
                  <span className="text-gray-400 font-normal text-xs ml-1">(up to {CLAIM_MAX_PHOTOS})</span>
                </label>

                {claimPhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {claimPhotos.map((p, idx) => (
                      <div key={idx} className="relative">
                        <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200">
                          <img src={p.preview} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                          {p.uploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        {!p.uploading && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); removeClaimPhoto(idx); }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {claimPhotos.length < CLAIM_MAX_PHOTOS && (
                  <label className="block cursor-pointer mb-4">
                    <div className="border-2 border-dashed border-gray-200 hover:border-[#0E4D34] rounded-xl p-4 text-center transition">
                      <p className="text-gray-400 text-xs">Click to add evidence photos</p>
                    </div>
                    <input type="file" accept="image/*" multiple onChange={handleClaimPhotoUpload} disabled={claimAnyUploading} className="hidden" />
                  </label>
                )}

                {claimError && <p className="text-red-500 text-xs font-semibold mb-4">{claimError}</p>}

                <div className="flex gap-3">
                  <button onClick={() => setShowClaimForm(false)} className="flex-1 border-2 border-gray-300 text-gray-600 font-bold py-3 rounded-full transition hover:bg-gray-50">
                    Back
                  </button>
                  <button
                    onClick={handleSubmitClaim}
                    disabled={claimSubmitting || claimAnyUploading}
                    className="flex-1 bg-[#0E4D34] hover:bg-[#0A3021] text-white font-black py-3 rounded-full transition disabled:opacity-50"
                  >
                    {claimSubmitting ? "Submitting..." : claimAnyUploading ? "Uploading..." : "Submit Claim"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </StudentLayout>
  );
}