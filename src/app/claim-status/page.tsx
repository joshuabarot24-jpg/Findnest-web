"use client";
// Student > Claim Status (/claim-status). Possible matches, claim cards with a 7-step tracker, appeals, secret questions.
// API: /claims/my-claims, /ai-matches/my-matches, /claims, /claims/{id}/appeal, /claims/{id}/questions, /claims/{id}/answers
import { useState, useEffect } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import StudentLayout from "@/components/StudentLayout";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

interface Claim {
  id: number;
  claim_status: string;
  proof_description: string;
  admin_notes: string | null;
  created_at: string;
  claimed_at: string | null;
  pickup_deadline: string | null;
  collected_at: string | null;
  appeal_message: string | null;
  appeal_status: string | null;
  ownership_questions?: { student_answer: string | null }[];
  verification_skipped?: boolean;
  verification_skip_reason?: string | null;
  timeline?: { action: string; at: string }[];
  match: {
    matched_at?: string | null;
    lost_report: { item_name: string; location_lost: string; description?: string | null; created_at?: string } | null;
    found_record: { item_name: string; location_found: string } | null;
  } | null;
}

interface PendingMatch {
  id: number;
  confidence_score: number;
  match_status: string;
  matched_at: string;
  lost_item: {
    item_name: string;
    category: string;
    location_lost: string;
  };
}

interface Question {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  student_answer: string | null;
  is_correct: boolean | null;
}

const TIMELINE_STEPS = [
  "Submitted",
  "Under AI Review",
  "Matched",
  "Claim Submitted",
  "Pending Verification",
  "Approved",
  "Returned",
];

function currentStepIndex(status: string, collectedAt: string | null): number {
  if (collectedAt) return 7;
  switch (status) {
    case "approved":
      return 6;
    case "pending":
    default:
      return 5;
  }
}

// mm/dd/yy
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(dateStr: string) {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function getStepDetail(claim: Claim, stepNum: number): { at: string | null; text: string } {
  const lost = claim.match?.lost_report;
  const found = claim.match?.found_record;
  const logAt = (action: string) => claim.timeline?.find((t) => t.action === action)?.at ?? null;

  switch (stepNum) {
    case 1:
      return {
        at: lost?.created_at ?? claim.created_at,
        text: lost
          ? `You reported "${lost.item_name}" lost at ${lost.location_lost}.${lost.description ? ` Description: ${lost.description}` : ""}`
          : "Your lost item report was submitted.",
      };
    case 2:
      return {
        at: lost?.created_at ?? claim.created_at,
        text: "The AI checked your photo and description, then searched the found items for possible matches.",
      };
    case 3:
      return {
        at: claim.match?.matched_at ?? null,
        text: found
          ? `The AI found a possible match: "${found.item_name}"${found.location_found ? `, found at ${found.location_found}` : ""}.`
          : "The AI found a possible match.",
      };
    case 4:
      return {
        at: claim.claimed_at ?? claim.created_at,
        text: `You submitted your claim.${claim.proof_description ? ` Your note: ${claim.proof_description}` : ""}`,
      };
    case 5:
      return {
        at: logAt("Ownership Questions Answered"),
        text: claim.verification_skipped
          ? "The verification questions were skipped for this claim. The Guidance Office is reviewing your evidence."
          : logAt("Ownership Questions Answered")
            ? "You answered the verification questions. The Guidance Office is reviewing all of your evidence."
            : "Waiting for you to answer the verification questions.",
      };
    case 6:
      return {
        at: logAt("Claim Approved"),
        text:
          claim.claim_status === "approved" || claim.collected_at
            ? `Your claim was approved.${claim.pickup_deadline ? ` Collect your item at the Guidance Office by ${formatDate(claim.pickup_deadline)}.` : ""}`
            : "Waiting for the Guidance Office's decision.",
      };
    case 7:
      return {
        at: claim.collected_at,
        text: claim.collected_at ? "Your item was collected at the Guidance Office." : "Not collected yet.",
      };
    default:
      return { at: null, text: "" };
  }
}

interface FoundRecord {
  id: number;
  item_name: string;
  location_found: string | null;
  status: string;
  created_at: string;
  surrender_deadline: string | null;
  receipt_confirmed: boolean;
  receipt_confirmed_at: string | null;
  progress?: {
    matched_at: string | null;
    claim_status: string | null;
    claimed_at: string | null;
    collected_at: string | null;
  };
}

const FOUND_STEPS = ["Submitted", "Waiting for Surrender", "Surrendered", "Matched", "Claimed", "Returned"];

function foundStepIndex(r: FoundRecord): number {
  const p = r.progress;
  if (p?.collected_at) return 6;
  if (p?.claimed_at) return 5;
  if (p?.matched_at) return 4;
  if (r.receipt_confirmed) return 3;
  return 2;
}

function getFoundStepDetail(r: FoundRecord, stepNum: number): { at: string | null; text: string } {
  const p = r.progress;
  switch (stepNum) {
    case 1:
      return {
        at: r.created_at,
        text: `You reported finding "${r.item_name}"${r.location_found ? ` at ${r.location_found}` : ""}.`,
      };
    case 2:
      return {
        at: r.created_at,
        text:
          !r.receipt_confirmed && r.surrender_deadline
            ? `Hand the item to the Guidance Office by ${formatDate(r.surrender_deadline)} (within 2 school days).`
            : "You were asked to hand the item to the Guidance Office within 2 school days.",
      };
    case 3:
      return {
        at: r.receipt_confirmed_at,
        text: r.receipt_confirmed
          ? "The Guidance Office confirmed receipt of your item. AI matching has started."
          : "Waiting for the Guidance Office to confirm they received the item.",
      };
    case 4:
      return {
        at: p?.matched_at ?? null,
        text: "The AI found a possible owner for your item. The Guidance Office will verify who it belongs to.",
      };
    case 5:
      return {
        at: p?.claimed_at ?? null,
        text:
          p?.claim_status === "approved"
            ? "A claim for your item was approved. The owner will collect it at the Guidance Office."
            : p?.claim_status === "rejected"
              ? "A claim for your item was rejected. The item is waiting for its real owner."
              : "Someone claimed your item. The Guidance Office is verifying the claim.",
      };
    case 6:
      return {
        at: p?.collected_at ?? null,
        text: p?.collected_at ? "The item was returned to its owner. Thank you for helping!" : "Not returned yet.",
      };
    default:
      return { at: null, text: "" };
  }
}

function FoundReportsPanel() {
  const [records, setRecords] = useState<FoundRecord[]>([]);
  const [foundLoading, setFoundLoading] = useState(true);
  const [openFoundStep, setOpenFoundStep] = useState<Record<number, number | null>>({});

  const fetchRecords = async () => {
    try {
      const response = await api.get("/found-items/mine");
      setRecords(response.data.records || []);
    } catch (err) {
      console.error("Error fetching found reports:", err);
    } finally {
      setFoundLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  useAutoRefresh(() => {
    fetchRecords();
  });

  if (foundLoading) {
    return <div className="text-center py-20 text-gray-400 text-sm">Loading found reports...</div>;
  }

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-3xl text-center py-16 text-gray-400">
        <p className="font-bold">No found item reports yet</p>
        <p className="text-sm mt-1">Items you report as found will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {records.map((record) => {
        const expired = record.status === "unsurrendered_expired";
        const step = expired ? 2 : foundStepIndex(record);
        const last = FOUND_STEPS.length - 1;
        const open = openFoundStep[record.id];

        return (
          <div key={record.id} className="bg-white rounded-3xl border border-[#D9E8DF] shadow-sm p-6 sm:p-8">
            <div className="mb-6">
              <p className="font-black text-gray-800 text-xl capitalize">{record.item_name}</p>
              <p className="text-gray-400 text-xs mt-1">Submitted {formatDate(record.created_at)}</p>
            </div>

            <div className="overflow-x-auto pt-2 pb-2 mb-4">
              <div className="flex items-start min-w-[30rem]">
                {FOUND_STEPS.map((label, idx) => {
                  const stepNum = idx + 1;
                  const done = stepNum <= step;
                  const at = done ? getFoundStepDetail(record, stepNum).at : null;
                  return (
                    <div key={label} className={`flex items-start ${idx < last ? "flex-1" : ""}`}>
                      <div className="flex flex-col items-center w-16 sm:w-20 shrink-0">
                        <div
                          onClick={() => setOpenFoundStep((prev) => ({ ...prev, [record.id]: prev[record.id] === stepNum ? null : stepNum }))}
                          role="button"
                          tabIndex={0}
                          className={`cursor-pointer w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            open === stepNum ? "ring-2 ring-offset-2 ring-[#1D2A6B]" : ""
                          } ${done ? "bg-[#1D2A6B] text-white" : "bg-gray-200 text-gray-400"}`}
                        >
                          {stepNum}
                        </div>
                        <span className={`mt-1 flex flex-col items-center text-[10px] sm:text-xs font-bold text-center leading-tight ${done ? "text-[#1D2A6B]" : "text-gray-400"}`}>
                          {at && (
                            <span className="order-last mt-0.5 text-[9px] font-normal text-gray-400">{timeAgo(at)}</span>
                          )}
                          {label}
                        </span>
                      </div>
                      {idx < last && (
                        <div className={`flex-1 h-0.5 mt-[13px] ${stepNum < step ? "bg-[#1D2A6B]" : "bg-gray-200"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {open && (() => {
              const detail = getFoundStepDetail(record, open);
              const reached = open <= step;
              return (
                <div className="bg-[#F4F7FB] border border-[#D6DCEF] rounded-xl p-4 mb-4">
                  <p className="font-black text-[#1D2A6B] text-sm">{open}. {FOUND_STEPS[open - 1]}</p>
                  <p className="text-gray-600 text-sm mt-1">{reached ? detail.text : "This step has not happened yet."}</p>
                  {reached && detail.at && (
                    <p className="text-gray-400 text-xs mt-2">{formatDateTime(detail.at)} · {timeAgo(detail.at)}</p>
                  )}
                </div>
              );
            })()}

            {expired ? (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 my-4">
                <p className="font-black text-red-600">Report Expired</p>
                <p className="text-red-500 text-sm mt-0.5">
                  The item was not handed to the Guidance Office within 2 school days, so the report expired and your trust score dropped by 5 points.
                </p>
              </div>
            ) : record.progress?.collected_at ? (
              <div className="bg-[#B9CBBF] rounded-xl p-4 my-4">
                <p className="font-black text-[#0A2618]">Item Returned to Owner</p>
                <p className="text-[#1E3F2E] text-sm mt-0.5">Thank you for helping. Returned on {formatDate(record.progress.collected_at)}.</p>
              </div>
            ) : !record.receipt_confirmed ? (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 my-4">
                <p className="font-black text-orange-600">Waiting for Surrender</p>
                <p className="text-orange-500 text-sm mt-0.5">
                  {record.surrender_deadline
                    ? `Hand the item to the Guidance Office by ${formatDate(record.surrender_deadline)}.`
                    : "Hand the item to the Guidance Office."}
                </p>
              </div>
            ) : (
              <div className="bg-[#B9CBBF] rounded-xl p-4 my-4">
                <p className="font-black text-[#0A2618]">Item Received</p>
                <p className="text-[#1E3F2E] text-sm mt-0.5">The Guidance Office has your item. We will notify you when the AI finds its owner.</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function daysRemaining(deadline: string): number {
  const now = new Date();
  const end = new Date(deadline);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ClaimStatusPage() {
  return (
    <AuthGate allowedRole="student">
      <ClaimStatusContent />
    </AuthGate>
  );
}

function ClaimStatusContent() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [tab, setTab] = useState<"lost" | "found">("lost");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "found") {
      setTab("found");
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [openStep, setOpenStep] = useState<Record<number, number | null>>({});

  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  const [claimingMatch, setClaimingMatch] = useState<PendingMatch | null>(null);
  const [proofDescription, setProofDescription] = useState("");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimPhotos, setClaimPhotos] = useState<{ preview: string; url: string | null; uploading: boolean }[]>([]);
  const CLAIM_MAX_PHOTOS = 3;

  const [appealingClaim, setAppealingClaim] = useState<Claim | null>(null);
  const [appealMessage, setAppealMessage] = useState("");
  const [appealPhotoPreview, setAppealPhotoPreview] = useState<string | null>(null);
  const [appealPhotoUrl, setAppealPhotoUrl] = useState<string | null>(null);
  const [appealPhotoUploading, setAppealPhotoUploading] = useState(false);
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealError, setAppealError] = useState("");

  const [answeringClaim, setAnsweringClaim] = useState<Claim | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [answersSubmitting, setAnswersSubmitting] = useState(false);
  const [answersError, setAnswersError] = useState("");
  const [answersResult, setAnswersResult] = useState<{ correct: number; total: number; passed: boolean } | null>(null);

  const fetchClaims = async () => {
    try {
      const response = await api.get("/claims/my-claims");
      setClaims(response.data.claims || []);
    } catch (err) {
      console.error("Error fetching claims:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingMatches = async () => {
    try {
      const response = await api.get("/ai-matches/my-matches");
      setPendingMatches(response.data.matches || []);
    } catch (err) {
      console.error("Error fetching pending matches:", err);
    } finally {
      setMatchesLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
    fetchPendingMatches();
  }, []);
  useAutoRefresh(() => {
    fetchClaims();
    fetchPendingMatches();
  });

  const claimUploadedUrls = claimPhotos.filter((p) => p.url).map((p) => p.url as string);
  const claimAnyUploading = claimPhotos.some((p) => p.uploading);

  const handleClaimPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    const tooBig = files.filter((f) => f.size > 5 * 1024 * 1024);
    if (tooBig.length > 0) {
      setClaimError("Each photo must be 5 MB or smaller. Please choose a smaller photo.");
    }
    const remainingSlots = CLAIM_MAX_PHOTOS - claimPhotos.length;
    const filesToAdd = files.filter((f) => f.size <= 5 * 1024 * 1024).slice(0, remainingSlots);
    if (filesToAdd.length === 0) return;

    const startIndex = claimPhotos.length;
    const newEntries = filesToAdd.map((file) => ({
      preview: URL.createObjectURL(file),
      url: null as string | null,
      uploading: true,
    }));
    setClaimPhotos((prev) => [...prev, ...newEntries]);

    for (let i = 0; i < filesToAdd.length; i++) {
      const file = filesToAdd[i];
      const idx = startIndex + i;
      try {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("folder", "appeal-evidence");
        formData.append("analyze", "false");
        const res = await api.post("/upload/image", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
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

  const removeClaimPhoto = (index: number) => {
    setClaimPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitClaim = async () => {
    if (!claimingMatch) return;
    if (claimUploadedUrls.length === 0) {
      setClaimError("Please add at least one evidence photo.");
      return;
    }

    setClaimError("");
    setClaimSubmitting(true);
    try {
      await api.post("/claims", {
        match_id: claimingMatch.id,
        proof_description: proofDescription.trim() || null,
        proof_photo_url: claimUploadedUrls[0] || null,
        proof_photo_urls: claimUploadedUrls,
      });
      setClaimingMatch(null);
      setProofDescription("");
      setClaimPhotos([]);
      fetchClaims();
      fetchPendingMatches();
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

  const handleAppealPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAppealPhotoPreview(URL.createObjectURL(file));
    setAppealPhotoUploading(true);
    setAppealPhotoUrl(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("folder", "appeal-evidence");
      formData.append("analyze", "false");

      const res = await api.post("/upload/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAppealPhotoUrl(res.data.url);
    } catch (err: any) {
      console.error("Appeal photo upload failed:", err);
      setAppealPhotoPreview(null);
      setAppealError(err.response?.data?.message || "Photo upload failed. Please try again.");
    } finally {
      setAppealPhotoUploading(false);
    }
  };

  const handleSubmitAppeal = async () => {
    if (!appealingClaim) return;
    if (!appealMessage.trim()) {
      setAppealError("Please provide additional evidence or explanation for your appeal.");
      return;
    }

    setAppealError("");
    setAppealSubmitting(true);
    try {
      await api.post(`/claims/${appealingClaim.id}/appeal`, {
        appeal_message: appealMessage.trim(),
        appeal_photo_url: appealPhotoUrl,
      });
      setAppealingClaim(null);
      setAppealMessage("");
      setAppealPhotoPreview(null);
      setAppealPhotoUrl(null);
      setAnsweringClaim(null);
      fetchClaims();
    } catch (err: any) {
      setAppealError(err.response?.data?.message || "Failed to submit appeal. Please try again.");
    } finally {
      setAppealSubmitting(false);
    }
  };

  const openAnswerModal = async (claim: Claim) => {
    setAnsweringClaim(claim);
    setAnswers({});
    setAnswersError("");
    setAnswersResult(null);
    setQuestionsLoading(true);
    try {
      let res = await api.get(`/claims/${claim.id}/questions`);
      // The questions are made in the background right after the claim. Wait 5 seconds, then re-check every 2 seconds
      for (let i = 0; i < 5 && (res.data.questions || []).length === 0; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 5000 : 2000));
        res = await api.get(`/claims/${claim.id}/questions`);
      }
      const fetchedQuestions: Question[] = res.data.questions || [];
      setQuestions(fetchedQuestions);

      const alreadyAnswered = fetchedQuestions.every((q) => q.student_answer !== null);
      if (alreadyAnswered && fetchedQuestions.length > 0) {
        const correct = fetchedQuestions.filter((q) => q.is_correct === true).length;
        setAnswersResult({ correct, total: fetchedQuestions.length, passed: correct >= 2 });
      }
    } catch (err) {
      console.error("Error fetching questions:", err);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleSelectAnswer = (questionId: number, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleSubmitAnswers = async () => {
    if (!answeringClaim) return;
    if (Object.keys(answers).length < questions.length) {
      setAnswersError("Please answer all questions before submitting.");
      return;
    }

    setAnswersError("");
    setAnswersSubmitting(true);
    try {
      const payload = {
        answers: questions.map((q) => ({
          question_id: q.id,
          answer: answers[q.id],
        })),
      };
      const res = await api.post(`/claims/${answeringClaim.id}/answers`, payload);
      setAnswersResult({
        correct: res.data.correct_count,
        total: res.data.total_count,
        passed: res.data.passed,
      });
    } catch (err: any) {
      setAnswersError(err.response?.data?.message || "Failed to submit answers. Please try again.");
    } finally {
      setAnswersSubmitting(false);
    }
  };

    return (
    <StudentLayout active="/claim-status">
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#0E4D34]">Claim Status</h1>
          <p className="text-gray-500 text-sm mt-1">Track the progress of your ownership claims</p>
        </div>

        <div className="flex gap-2 mb-6">
          {([["lost", "Lost Reports"], ["found", "Found Reports"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition ${
                tab === key
                  ? "bg-[#0E4D34] text-white"
                  : "bg-white border border-[#B9CBBF] text-[#0E4D34] hover:bg-[#F1F7F3]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={tab === "found" ? "" : "hidden"}>
          <FoundReportsPanel />
        </div>

        {tab === "lost" && !matchesLoading && pendingMatches.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-black text-[#0E4D34] uppercase tracking-wide mb-3">
              Possible Matches for Your Lost Items
            </h2>
            <div className="space-y-3">
              {pendingMatches.map((match) => (
                <div key={match.id} className="bg-white border border-[#B9CBBF] rounded-3xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                    <div className="flex-1 min-w-[12rem]">
                      <p className="font-black text-[#0E4D34]">{match.lost_item.item_name}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        {match.confidence_score}% confidence match &middot; {match.lost_item.category}
                      </p>
                    </div>
                    <button
                      onClick={() => { setClaimingMatch(match); setProofDescription(""); setClaimError(""); setClaimPhotos([]); }}
                      className="bg-[#0E4D34] hover:bg-[#0A3021] text-white text-sm font-bold px-5 py-2.5 rounded-full transition whitespace-nowrap"
                    >
                      Submit Claim
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "found" ? (
          null
        ) : loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading lost reports...</div>
        ) : claims.length === 0 ? (
          <div className="bg-white rounded-3xl text-center py-16 text-gray-400">
            <p className="font-bold text-lg">No claims submitted yet</p>
            <p className="text-sm mt-1">Once you claim a matched item, its status will appear here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {claims.map((claim) => {
              const item = claim.match?.found_record || claim.match?.lost_report;
              const itemName = item?.item_name || "Unknown Item";
              const step = currentStepIndex(claim.claim_status, claim.collected_at);
              const isTerminal = ["rejected", "abandoned"].includes(claim.claim_status);
              const canAppeal = claim.claim_status === "rejected" && !claim.appeal_status;
              const last = TIMELINE_STEPS.length - 1;

              return (
                <div key={claim.id} className="bg-white rounded-3xl border border-[#D9E8DF] shadow-sm p-6 sm:p-8">
                  <div className="mb-6">
                    <p className="font-black text-gray-800 text-xl capitalize">{itemName}</p>
                    <p className="text-gray-400 text-xs mt-1">Submitted {formatDate(claim.created_at)}</p>
                  </div>

                  {!isTerminal && (
                    <div className="overflow-x-auto pt-2 pb-2 mb-4">
                      <div className="flex items-start min-w-[34rem]">
                        {TIMELINE_STEPS.map((label, idx) => {
                          const stepNum = idx + 1;
                          const done = stepNum <= step;
                          return (
                            <div key={label} className={`flex items-start ${idx < last ? "flex-1" : ""}`}>
                              <div className="flex flex-col items-center w-16 sm:w-20 shrink-0">
                                <div
                                  onClick={() => setOpenStep((prev) => ({ ...prev, [claim.id]: prev[claim.id] === stepNum ? null : stepNum }))}
                                  role="button"
                                  tabIndex={0}
                                  className={`cursor-pointer w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${openStep[claim.id] === stepNum ? "ring-2 ring-offset-2 ring-[#1D2A6B]" : ""} ${
                                    done ? "bg-[#1D2A6B] text-white" : "bg-gray-200 text-gray-400"
                                  }`}
                                >
                                  {stepNum}
                                </div>
                                <span className={`mt-1 flex flex-col items-center text-[10px] sm:text-xs font-bold text-center leading-tight ${done ? "text-[#1D2A6B]" : "text-gray-400"}`}>
                                  {done && getStepDetail(claim, stepNum).at && (
                                    <span className="order-last mt-0.5 text-[9px] font-normal text-gray-400">
                                      {timeAgo(getStepDetail(claim, stepNum).at as string)}
                                    </span>
                                  )}
                                  {label}
                                </span>
                              </div>
                              {idx < last && (
                                <div className={`flex-1 h-0.5 mt-[13px] ${stepNum < step ? "bg-[#1D2A6B]" : "bg-gray-200"}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!isTerminal && openStep[claim.id] && (() => {
                    const n = openStep[claim.id] as number;
                    const detail = getStepDetail(claim, n);
                    const reached = n <= step;
                    return (
                      <div className="bg-[#F4F7FB] border border-[#D6DCEF] rounded-xl p-4 mb-4">
                        <p className="font-black text-[#1D2A6B] text-sm">{n}. {TIMELINE_STEPS[n - 1]}</p>
                        <p className="text-gray-600 text-sm mt-1">{reached ? detail.text : "This step has not happened yet."}</p>
                        {reached && detail.at && (
                          <p className="text-gray-400 text-xs mt-2">{formatDateTime(detail.at)} · {timeAgo(detail.at)}</p>
                        )}
                      </div>
                    );
                  })()}
                  {/* Status banner */}
                  {claim.collected_at ? (
                    <div className="bg-[#B9CBBF] rounded-xl p-4 my-4">
                      <p className="font-black text-[#0A2618]">Item is Returned</p>
                      <p className="text-[#1E3F2E] text-sm mt-0.5">Collected on {formatDate(claim.collected_at)}</p>
                    </div>
                  ) : claim.claim_status === "approved" ? (
                    <div className="bg-[#B9CBBF] rounded-xl p-4 my-4">
                      <p className="font-black text-[#0A2618]">Item Ready for Pickup</p>
                      <p className="text-[#1E3F2E] text-sm mt-0.5">
                        {claim.pickup_deadline
                          ? `Visit the Guidance Office by ${formatDate(claim.pickup_deadline)}${
                              daysRemaining(claim.pickup_deadline) >= 0
                                ? ` (${daysRemaining(claim.pickup_deadline)} day${daysRemaining(claim.pickup_deadline) === 1 ? "" : "s"} left)`
                                : " — deadline passed"
                            }`
                          : "Visit the Guidance Office to collect your item."}
                      </p>
                    </div>
                  ) : claim.claim_status === "rejected" ? (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 my-4">
                      <p className="font-black text-red-600">Claim Rejected</p>
                      {claim.admin_notes && <p className="text-red-500 text-sm mt-0.5">Reason: {claim.admin_notes}</p>}
                      {claim.appeal_status === "pending" && (
                        <p className="text-orange-600 text-xs mt-2 font-semibold">The Guidance Office is reviewing your appeal.</p>
                      )}
                    </div>
                  ) : claim.claim_status === "abandoned" ? (
                    <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 my-4">
                      <p className="font-black text-gray-600">Claim Abandoned</p>
                      <p className="text-gray-500 text-sm mt-0.5">Pickup window expired without collection. The item returned to unclaimed status.</p>
                    </div>
                  ) : (
                    <div className="bg-[#E3EEE7] rounded-xl p-4 my-4">
                      <p className="font-black text-[#0A2618]">Under Review</p>
                      <p className="text-[#1E3F2E] text-sm mt-0.5">An admin is verifying your claim.</p>
                    </div>
                  )}

                  {claim.claim_status === "pending" && claim.verification_skipped && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                      <p className="text-blue-700 text-sm font-bold">No Secret Questions Needed</p>
                      <p className="text-blue-600 text-xs mt-1">
                        This item didn&apos;t have enough distinguishing details for verification questions. Your claim will be reviewed based on your description and photos. If you have physical proof of ownership, please visit the Guidance Office.
                      </p>
                    </div>
                  )}

                  {claim.claim_status === "pending" && !claim.verification_skipped && !(claim.ownership_questions && claim.ownership_questions.length > 0 && claim.ownership_questions.every((q) => q.student_answer !== null)) && (
                    <button
                      onClick={() => openAnswerModal(claim)}
                      className="w-full bg-[#E3EEE7] hover:bg-[#0E4D34] hover:text-white text-[#0E4D34] font-bold py-2.5 rounded-xl transition text-sm mb-4"
                    >
                      Answer Verification Questions
                    </button>
                  )}

                  {canAppeal && (
                    <button
                      onClick={() => {
                        setAppealingClaim(claim);
                        setAppealMessage("");
                        setAppealPhotoPreview(null);
                        setAppealPhotoUrl(null);
                        setAppealError("");
                      }}
                      className="w-full bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold py-2.5 rounded-xl transition text-sm mb-4"
                    >
                      Appeal This Decision
                    </button>
                  )}

                  <div className="bg-gray-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Item Description</p>
                    <p className="text-gray-600 text-sm">{claim.proof_description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {claimingMatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setClaimingMatch(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-xl font-black text-[#0E4D34] mb-1">Submit Ownership Proof</h2>
            <p className="text-gray-400 text-sm mb-6">
              For your reported &quot;{claimingMatch.lost_item.item_name}&quot;
            </p>

            <div className="bg-[#E3EEE7] border border-[#B9CBBF] rounded-xl p-4 mb-5">
              <p className="text-[#1E3F2E] text-xs leading-relaxed">
                To verify your claim, please upload photos or digital evidence demonstrating your ownership of this item (e.g., photos showing you with the item, receipts, serial numbers, or unique identifying features). You will also be asked a few verification questions after submitting.
              </p>
            </div>

            <label className="block text-sm font-bold text-gray-600 mb-2">Evidence Note (Optional)</label>
            <input
              type="text"
              value={proofDescription}
              onChange={(e) => setProofDescription(e.target.value.slice(0, 100))}
              maxLength={100}
              placeholder="e.g., Picture of me with the item taken last month"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#0E4D34] focus:outline-none transition text-gray-700 mb-1"
            />
            <p className="text-right text-[11px] text-gray-400 mb-4">{proofDescription.length}/100</p>

            <label className="block text-sm font-bold text-gray-600 mb-2">
              Ownership Evidence Photos <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal text-xs ml-1">(up to {CLAIM_MAX_PHOTOS})</span>
            </label>

            {claimPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                {claimPhotos.map((p, idx) => (
                  <div key={idx} className="relative">
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200">
                      <img src={p.preview} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" title={`Evidence ${idx + 1}`} />
                      {p.uploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    {!p.uploading && (
                      <button
                        type="button"
                        onClick={() => removeClaimPhoto(idx)}
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
                  <p className="text-gray-400 text-xs">
                    {claimPhotos.length === 0 ? "Drag and drop ownership evidence photos here, or click to browse" : `Add more (${CLAIM_MAX_PHOTOS - claimPhotos.length} left)`}
                  </p>
                </div>
                <input type="file" accept="image/*" multiple onChange={handleClaimPhotoUpload} disabled={claimAnyUploading} className="hidden" />
              </label>
            )}

            {claimError && <p className="text-red-500 text-xs font-semibold mb-4">{claimError}</p>}

            <button
              onClick={handleSubmitClaim}
              disabled={claimSubmitting || claimAnyUploading || claimUploadedUrls.length === 0}
              className="w-full bg-[#0F4C3A] hover:bg-[#0C3D2E] text-white font-black py-3.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claimSubmitting ? "Submitting..." : claimAnyUploading ? "Uploading photos..." : "Submit Claim Verification"}
            </button>
          </div>
        </div>
      )}

      {appealingClaim && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setAppealingClaim(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-xl font-black text-[#0E4D34] mb-1">Appeal Rejected Claim</h2>
            <p className="text-gray-400 text-sm mb-6">The Guidance Office will review your appeal and make the final decision</p>

            <label className="block text-sm font-bold text-gray-600 mb-2">Additional Evidence or Explanation</label>
            <textarea
              value={appealMessage}
              onChange={(e) => setAppealMessage(e.target.value)}
              placeholder="Provide new evidence or explain why you believe this decision should be reconsidered..."
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#0E4D34] focus:outline-none transition text-gray-700 resize-none mb-4"
            />

            <label className="block text-sm font-bold text-gray-600 mb-2">Supporting Photo (Optional)</label>
            <label className="block cursor-pointer mb-4">
              <div className="border-2 border-dashed border-gray-200 hover:border-[#0E4D34] rounded-xl p-5 text-center transition">
                {appealPhotoUploading ? (
                  <p className="text-sm text-gray-500 font-medium">Uploading...</p>
                ) : appealPhotoPreview ? (
                  <div>
                    <img src={appealPhotoPreview} alt="Appeal evidence" className="max-h-32 mx-auto rounded-xl" />
                    {appealPhotoUrl && <p className="text-green-600 text-xs font-bold mt-2">Uploaded successfully</p>}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">Click to attach a photo the admin can review</p>
                )}
              </div>
              <input type="file" accept="image/*" onChange={handleAppealPhotoUpload} disabled={appealPhotoUploading} className="hidden" />
            </label>

            {appealError && <p className="text-red-500 text-xs font-semibold mb-4">{appealError}</p>}

            <button
              onClick={handleSubmitAppeal}
              disabled={appealSubmitting || appealPhotoUploading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3.5 rounded-xl transition disabled:opacity-50"
            >
              {appealSubmitting ? "Submitting..." : "Submit Appeal"}
            </button>
          </div>
        </div>
      )}

      {answeringClaim && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setAnsweringClaim(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-xl font-black text-[#0E4D34] mb-1">Ownership Verification</h2>
            <p className="text-gray-400 text-sm mb-6">Answer these questions to help confirm you&apos;re the true owner</p>

            {questionsLoading ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                <div className="w-6 h-6 mx-auto mb-3 border-4 border-blue-200 border-t-[#1a237e] rounded-full animate-spin" />
                Generating secret verification questions...
              </div>
            ) : answeringClaim?.verification_skipped ? (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
                <p className="text-blue-700 font-bold text-sm mb-1">No Questions Needed</p>
                <p className="text-blue-600 text-xs leading-relaxed">
                  This item didn&apos;t have enough distinguishing details for secret questions. Your claim will be reviewed based on your description and photos. If you have physical proof of ownership, please visit the Guidance Office.
                </p>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Questions could not be generated. Please contact guidance.</div>
            ) : answersResult ? (
              <div className={`rounded-2xl p-6 text-center ${answersResult.correct >= 2 ? "bg-green-50 border border-green-100" : "bg-yellow-50 border border-yellow-100"}`}>
                <p className={`text-2xl font-black ${answersResult.correct >= 2 ? "text-green-700" : "text-yellow-700"}`}>
                  {answersResult.correct}/{answersResult.total} Correct
                </p>
                <p className="text-gray-600 text-sm mt-2">
                  {answersResult.correct >= 2
                    ? "Your answers have been recorded. The admin will review your full claim."
                    : "Your answers have been recorded, but were not all correct. The admin will still review your full claim."}
                </p>
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setAnsweringClaim(null)}
                    className="flex-1 border-2 border-gray-200 text-gray-500 font-bold px-6 py-3 rounded-xl transition hover:bg-gray-50"
                  >
                    Close
                  </button>
                  {answeringClaim.claim_status === "rejected" && !answeringClaim.appeal_status && (
                    <button
                      onClick={() => {
                        setAppealingClaim(answeringClaim);
                        setAppealMessage("");
                        setAppealPhotoPreview(null);
                        setAppealPhotoUrl(null);
                        setAppealError("");
                      }}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl transition"
                    >
                      Appeal This Decision
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {questions.map((q, idx) => (
                  <div key={q.id} className="bg-gray-50 rounded-2xl p-4">
                    <p className="font-bold text-gray-700 text-sm mb-3">Q{idx + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {(["a", "b", "c", "d"] as const).map((opt) => {
                        const optionText = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d }[opt];
                        const isSelected = answers[q.id] === opt;
                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelectAnswer(q.id, opt)}
                            className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm transition ${
                              isSelected
                                ? "border-[#0E4D34] bg-[#E3EEE7] text-[#0E4D34] font-bold"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                          >
                            {optionText}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {answersError && <p className="text-red-500 text-xs font-semibold">{answersError}</p>}

                <button
                  onClick={handleSubmitAnswers}
                  disabled={answersSubmitting}
                  className="w-full bg-[#0E4D34] hover:bg-[#0A3021] text-white font-black py-3.5 rounded-xl transition disabled:opacity-50"
                >
                  {answersSubmitting ? "Submitting..." : "Submit Answers"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </StudentLayout>
  );
}