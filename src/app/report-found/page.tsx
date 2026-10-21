"use client";
// Student > Report Found (/report-found). Form, review, confirmation and success steps.
// API: /upload/image, /upload/analyze-existing, /found-items
import { useState } from "react";
import api from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import StudentLayout from "@/components/StudentLayout";

const categories = ["Electronics", "Personal Belongings", "ID/Cards", "Keys", "School Supplies", "Accessories", "Others"];
const MAX_PHOTOS = 1;

const FIELD =
  "w-full px-4 py-3 bg-gray-100/80 rounded-xl border-2 border-transparent focus:border-[#0E4D34] focus:bg-white focus:outline-none transition text-gray-700 text-sm";

interface PhotoItem {
  preview: string;
  url: string | null;
  uploading: boolean;
}

export default function ReportFoundPage() {
  return (
    <AuthGate allowedRole="student">
      <ReportFoundContent />
    </AuthGate>
  );
}

function ReportFoundContent() {
  const [step, setStep] = useState<"form" | "review">("form");

  const [itemName, setItemName] = useState("");
  const [itemNameAiFilled, setItemNameAiFilled] = useState(false);
  const [category, setCategory] = useState("Electronics");
  const [othersSpecify, setOthersSpecify] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [brandModel, setBrandModel] = useState("");
  const [description, setDescription] = useState("");
  const [aiFilled, setAiFilled] = useState(false);
  const [location, setLocation] = useState("");

  function getManilaDate(daysAgo: number) {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  }

  const [date, setDate] = useState(() => getManilaDate(0));
  const [time, setTime] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoError, setPhotoError] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [photoErrorMessage, setPhotoErrorMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const [itemChoices, setItemChoices] = useState<string[]>([]);
  const [choosingItemUrl, setChoosingItemUrl] = useState<string | null>(null);
  const [resolvingChoice, setResolvingChoice] = useState(false);

  // What the AI detected, shown next to the student's own entries in the review step
  const [aiData, setAiData] = useState({ name: "", category: "", color: "", brand: "" });

  const anyUploading = photos.some((p) => p.uploading);
  const uploadedUrls = photos.filter((p) => p.url).map((p) => p.url as string);

  const applyAiFields = (data: any) => {
    setAiData({
      name: data.ai_item_name || "",
      category: data.ai_category || "",
      color: data.ai_details?.primary_color || "",
      brand: data.ai_details?.brand_or_markings || "",
    });
    if (data.ai_item_name) {
      setItemName(data.ai_item_name);
      setItemNameAiFilled(true);
    }
    if (data.ai_category && categories.includes(data.ai_category)) {
      setCategory(data.ai_category);
    }
    if (data.ai_description) {
      setDescription(data.ai_description);
      setAiFilled(true);
    }
    if (data.ai_details?.primary_color) {
      setPrimaryColor(data.ai_details.primary_color);
    }
    if (data.ai_details?.brand_or_markings) {
      setBrandModel(data.ai_details.brand_or_markings);
    }
  };

  // Drag and drop: hands the dropped image to the same upload function as the file picker
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (anyUploading) return;
    const images = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      setPhotoError(true);
      setPhotoErrorMessage("Please drop an image file (JPG, PNG, etc.).");
      return;
    }
    handlePhotoUpload({ target: { files: images, value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = MAX_PHOTOS - photos.length;
    const filesToAdd = files.slice(0, remainingSlots);
    if (filesToAdd.length === 0) return;

    setPhotoError(false);
    setPhotoErrorMessage("");
    const isFirstPhoto = photos.length === 0;

    const newEntries: PhotoItem[] = filesToAdd.map((file) => ({
      preview: URL.createObjectURL(file),
      url: null,
      uploading: true,
    }));
    const startIndex = photos.length;
    setPhotos((prev) => [...prev, ...newEntries]);

    for (let i = 0; i < filesToAdd.length; i++) {
      const file = filesToAdd[i];
      const idx = startIndex + i;
      try {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("folder", "found-items");

        const res = await api.post("/upload/image", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setPhotos((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], url: res.data.url, uploading: false };
          return next;
        });

        if (isFirstPhoto && idx === startIndex) {
          applyAiFields(res.data);
        }
      } catch (err: any) {
        if (err.response?.data?.multiple_items && isFirstPhoto && idx === startIndex) {
          setPhotos((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], url: err.response.data.url, uploading: false };
            return next;
          });
          setItemChoices(err.response.data.items_found || []);
          setChoosingItemUrl(err.response.data.url);
          continue;
        }
        console.error("Photo upload failed:", err);
        setPhotos((prev) => prev.filter((_, i2) => i2 !== idx));
        setPhotoErrorMessage(err.response?.data?.message || "One of your photos failed to upload. Please try again.");
        setPhotoError(true);
      }
    }
    e.target.value = "";
  };

  const handleChooseItem = async (choice: string) => {
    if (!choosingItemUrl) return;
    setResolvingChoice(true);
    try {
      const res = await api.post("/upload/analyze-existing", {
        url: choosingItemUrl,
        item_hint: choice,
      });
      applyAiFields(res.data);
    } catch (err: any) {
      console.error("Failed to analyze chosen item:", err);
      setPhotoErrorMessage(err.response?.data?.message || "Could not analyze the selected item. You can still fill the fields manually.");
    } finally {
      setChoosingItemUrl(null);
      setItemChoices([]);
      setResolvingChoice(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Form -> review step
  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadedUrls.length === 0) {
      setPhotoError(true);
      return;
    }
    if (!description.trim()) {
      setSubmitError("Description is required. Please add details manually since our AI could not auto-fill it.");
      return;
    }
    setSubmitError("");
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFinalSubmit = async () => {
    setSubmitLoading(true);
    try {
      await api.post("/found-items", {
        item_name: itemName,
        category: category === "Others" ? othersSpecify.trim() : category,
        description: description,
        location_found: location,
        date_found: date,
        photo_url: uploadedUrls[0] || null,
        photo_urls: uploadedUrls,
        approx_time: time,
        primary_color: primaryColor,
        brand_model: brandModel,
      });
      setShowConfirm(false);
      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting report:", err);
      setShowConfirm(false);
      alert(err.response?.data?.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const finalCategory = category === "Others" ? othersSpecify : category;
    const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-bold text-slate-900 mb-1.5">{children}</label>
  );

  const CloseX = (
    <button
      type="button"
      onClick={() => (window.location.href = "/student-home")}
      className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition text-2xl leading-none"
      aria-label="Close"
    >
      &times;
    </button>
  );

  const ReviewRow = ({ label, value }: { label: string; value: string }) => (
    <p className="text-sm">
      <span className="font-bold text-slate-900">{label}:</span>{" "}
      <span className="text-gray-500">{value || "—"}</span>
    </p>
  );

  return (
    <StudentLayout active="/report-found" hideHeader>
      <div className="w-full flex-1 flex flex-col justify-center pb-6">
        {step === "form" ? (
          <div className="bg-white rounded-3xl border border-[#D9E8DF] shadow-sm overflow-hidden">
            <div className="px-6 sm:px-8 pt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Report Found Item</p>
                {CloseX}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0E4D34] mt-1">I Found Something</h1>
            </div>

            <form onSubmit={handleReview}>
              {/* While a photo is being analyzed, everything in the form is locked */}
              <fieldset disabled={anyUploading} className="min-w-0 border-0 p-0 m-0">
                <div className="px-6 sm:px-8 pt-5 pb-6">
                  {anyUploading && (
                    <div className="flex items-center gap-3 bg-[#E3EEE7] border border-[#B9CBBF] rounded-xl px-4 py-3 mb-4">
                      <div className="w-5 h-5 border-4 border-[#B9CBBF] border-t-[#0E4D34] rounded-full animate-spin shrink-0" />
                      <p className="text-[#1E3F2E] text-sm font-semibold">Analyzing your photo... please wait. The form is locked until it finishes.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-6">
                    {/* Photo upload box */}
                    <div>
                      <div className="rounded-2xl bg-[#D8E6DF] p-5 flex flex-col items-center justify-center text-center min-h-[20rem] h-full">
                        {photos.length > 0 ? (
                          <div className="relative w-full">
                            <div className="w-full rounded-xl overflow-hidden bg-white/60 flex items-center justify-center">
                              <img src={photos[0].preview} alt="Found item" className="w-full max-h-72 object-contain" />
                              {photos[0].uploading && (
                                <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-2">
                                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span className="text-white text-xs font-bold">Analyzing photo...</span>
                                </div>
                              )}
                            </div>
                            {!photos[0].uploading && (
                              <button
                                type="button"
                                onClick={() => removePhoto(0)}
                                className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-base font-bold shadow"
                                aria-label="Remove photo"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ) : (
                          <label
                            onDragOver={(e) => { e.preventDefault(); if (!anyUploading) setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            className={`w-full h-full cursor-pointer rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center transition ${
                              photoError ? "border-red-400 bg-red-50/60" : dragOver ? "border-[#0E4D34] bg-white/50" : "border-transparent"
                            }`}
                          >
                            <div className="w-16 h-16 rounded-2xl bg-gray-300/70 flex items-center justify-center text-gray-500 mb-3">
                              <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg>
                            </div>
                            <p className="font-bold text-slate-900 text-sm">{dragOver ? "Drop the photo here" : "Click/tap to upload photo"}</p>
                            <p className="text-gray-600 text-xs mt-2 leading-relaxed">
                              FindNest uses advanced AI image recognition to match lost and found items on campus. Submit a report, get notified instantly.
                            </p>
                            <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={anyUploading} className="hidden" />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6 content-between">
                      <div>
                        <Label>Item Name {itemNameAiFilled && <span className="text-green-600 font-normal">(auto-detected, editable)</span>}</Label>
                        <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Scientific Calculator" className={FIELD} required />
                      </div>
                      <div>
                        <Label>Category {uploadedUrls.length > 0 && <span className="text-green-600 font-normal">(auto-detected, editable)</span>}</Label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD}>
                          {categories.map((cat) => (
                            <option key={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      {category === "Others" && (
                        <div className="sm:col-span-2">
                          <Label>Please Specify</Label>
                          <input type="text" value={othersSpecify} onChange={(e) => setOthersSpecify(e.target.value)} placeholder="Tell us what kind of item this is" className={FIELD} required />
                        </div>
                      )}

                      <div>
                        <Label>Primary Colors {primaryColor ? <span className="text-green-600 font-normal">(auto-detected, editable)</span> : <span className="text-red-500">*</span>}</Label>
                        <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="e.g. Black, Silver" className={FIELD} />
                      </div>
                      <div>
                        <Label>Model and Brand {brandModel ? <span className="text-green-600 font-normal">(auto-detected, editable)</span> : <span className="text-red-500">*</span>}</Label>
                        <input type="text" value={brandModel} onChange={(e) => setBrandModel(e.target.value)} placeholder="e.g. Apple iPhone 15" className={FIELD} />
                      </div>

                      <div>
                        <Label>Date Found</Label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={getManilaDate(2)} max={getManilaDate(0)} className={FIELD} required />
                        <p className="text-gray-400 text-[11px] mt-1">Today or up to 2 days ago.</p>
                      </div>
                      <div>
                        <Label>Approx. Time Found</Label>
                        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
                      </div>

                      <div className="sm:col-span-2">
                        <Label>Location Found</Label>
                        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Library, Canteen, Room 402" className={FIELD} required />
                      </div>

                      <div className="sm:col-span-2">
                        <Label>Item Description {aiFilled ? <span className="text-green-600 font-normal">(auto-filled by AI, editable)</span> : <span className="text-red-500">*</span>}</Label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={aiFilled ? "" : "If our AI could not auto-fill this, please describe the item manually. Any details that might help identify the owner."}
                          rows={6}
                          className={`${FIELD} resize-none ${!aiFilled && !description.trim() ? "!bg-green-50" : ""}`}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 mt-5">
                    {photoError && (
                      <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                        <p className="text-sm font-semibold leading-snug">
                          {photoErrorMessage || "At least one photo is required before you can submit this report."}
                        </p>
                      </div>
                    )}

                    {submitError && (
                      <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                        <p className="text-sm font-semibold leading-snug">{submitError}</p>
                      </div>
                    )}

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="font-bold text-orange-800 text-sm mb-1">Surrender Reminder!</p>
                      <p className="text-orange-700 text-xs leading-relaxed">
                        You must surrender this item to <strong>Ms. Shelly S. Durban</strong> at the Guidance Office within <strong>2 school days</strong>. Failure to do so will result in automatic post rejection and account flagging.
                      </p>
                    </div>

                    <p className="text-gray-500 text-xs">This report is private and visible only to you and administrators.</p>
                  </div>
                </div>

                {/* Footer with soft green gradient */}
                <div className="bg-gradient-to-t from-green-300 via-green-100 to-transparent px-6 pt-4 pb-16 flex justify-center">
                  <button
                    type="submit"
                    disabled={anyUploading || uploadedUrls.length === 0}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-full shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {anyUploading ? "Waiting for photo analysis..." : "Click to submit report"}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        ) : (
          /* Review step */
          <div className="bg-white rounded-3xl border border-[#D9E8DF] shadow-sm overflow-hidden">
            <div className="px-6 sm:px-8 pt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Report review</p>
                {CloseX}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">Review Your Report</h1>
            </div>

            <div className="px-6 sm:px-8 pt-5 pb-6">
              <div className="bg-[#EBF3EF] rounded-2xl p-6 mb-6 flex flex-wrap items-center gap-6">
                <div className="w-32 h-32 bg-gray-300 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                  {photos[0]?.preview ? (
                    <img src={photos[0].preview} alt="Found item" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-gray-500 text-xs">No photo</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-3xl font-bold text-slate-900 break-words">{itemName}</p>
                  <p className="text-slate-700 mt-1">{primaryColor || "Color not specified"}</p>
                  <p className="text-slate-500 text-sm mt-0.5">{brandModel || "Brand not specified"}</p>
                </div>
              </div>

              <div className="bg-[#F3FAF6] rounded-2xl p-6 mb-4 grid grid-cols-1 md:grid-cols-2">
                <div className="space-y-2 pb-5 md:pb-0 md:pr-6 border-b md:border-b-0 md:border-r border-slate-300">
                  <p className="text-xs font-black text-[#0E4D34] uppercase tracking-wider mb-2">You submitted</p>
                  <ReviewRow label="Item Name" value={itemName} />
                  <ReviewRow label="Category" value={finalCategory} />
                  <ReviewRow label="Primary color" value={primaryColor} />
                  <ReviewRow label="Brand and Models" value={brandModel} />
                </div>
                <div className="space-y-2 pt-5 md:pt-0 md:pl-6">
                  <p className="text-xs font-black text-[#0E4D34] uppercase tracking-wider mb-2">AI analyzed</p>
                  <ReviewRow label="Item Name" value={aiData.name} />
                  <ReviewRow label="Category" value={aiData.category} />
                  <ReviewRow label="Primary color" value={aiData.color} />
                  <ReviewRow label="Brand and Models" value={aiData.brand} />
                </div>
              </div>

              <div className="bg-[#F3FAF6] rounded-2xl p-6 space-y-2">
                <ReviewRow label="Description" value={description} />
                <ReviewRow label="Found at" value={location} />
                <ReviewRow label="Date found" value={`${date}${time ? ` at ${time}` : ""}`} />
              </div>
            </div>

            <div className="bg-gradient-to-t from-green-300 via-green-100 to-transparent px-6 pt-4 pb-16 flex flex-col items-center gap-3">
              <button
                onClick={() => setShowConfirm(true)}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-full shadow-md transition"
              >
                Click to submit report
              </button>
              <button onClick={() => setStep("form")} className="text-sm font-semibold text-gray-600 hover:underline">
                &larr; Edit report
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Multiple items chooser */}
      {choosingItemUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-[#0E4D34] mb-1">Multiple Items Detected</h2>
            <p className="text-gray-500 text-sm mb-6">We found several items in your photo. Which one did you find?</p>

            {resolvingChoice ? (
              <div className="py-8 text-center">
                <div className="w-8 h-8 border-4 border-[#B9CBBF] border-t-[#0E4D34] rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">Analyzing your selection...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {itemChoices.map((choice, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleChooseItem(choice)}
                    className="w-full text-left px-4 py-3 border-2 border-gray-200 hover:border-[#0E4D34] hover:bg-[#F3FAF6] rounded-xl transition text-gray-700 font-semibold text-sm"
                  >
                    {choice}
                  </button>
                ))}
                <button
                  onClick={() => { setChoosingItemUrl(null); setItemChoices([]); }}
                  className="w-full text-center px-4 py-3 text-gray-500 hover:text-gray-700 text-sm font-semibold mt-2"
                >
                  None of these, I&apos;ll fill in details manually
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation */}
      {showConfirm && !submitted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Submit Found-item Report?</h2>
              <p className="text-sm text-slate-600">
                Send report to the campus lost and found located in<br />Guidance office
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-6 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={submitLoading}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2.5 px-6 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {submitLoading ? "Submitting..." : "Confirm Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {submitted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111424]/75 backdrop-blur-md px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Report Submitted Successfully</h2>
              <p className="text-sm text-slate-600">
                Send report to the campus lost and found located in<br />Guidance office
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <p className="font-bold text-orange-700 text-sm mb-1">Important Reminder!</p>
              <p className="text-orange-600 text-xs leading-relaxed">
                Surrender this item to <strong>Ms. Shelly S. Durban</strong> at the Guidance Office within <strong>2 school days</strong>. If not surrendered in that window, the post will be automatically rejected and your account may be flagged.
              </p>
            </div>
            <div className="flex gap-3">
              <a href="/claim-status" className="flex-1 text-center bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm transition">
                View Claim Status
              </a>
              <a href="/student-home" className="flex-1 text-center bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm transition">
                Back to Home
              </a>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}