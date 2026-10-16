"use client";
// [UI] Auto-playing hero carousel: system features + school campaigns. Crossfade, dots, pause on hover.
import { useEffect, useState } from "react";

const SLIDES = [
  {
    tag: "System Feature",
    title: "AI Image Matching",
    text: "Upload a photo and our AI finds likely matches automatically.",
    bg: "from-[#D9F2E4] to-[#9FD8B9]",
    art: (
      <>
        <rect x="30" y="40" width="60" height="50" rx="8" />
        <circle cx="50" cy="58" r="7" />
        <path d="m30 84 18-16 14 12 10-8 18 14" />
        <circle cx="118" cy="82" r="18" />
        <path d="m131 95 14 14" />
      </>
    ),
  },
  {
    tag: "System Feature",
    title: "Instant Notifications",
    text: "Get alerted the moment a possible match is found.",
    bg: "from-[#E3F6EC] to-[#A8DEC0]",
    art: (
      <>
        <path d="M60 100V70a30 30 0 0 1 60 0v30l10 12H50z" />
        <path d="M80 122a10 10 0 0 0 20 0" />
        <circle cx="118" cy="48" r="9" />
      </>
    ),
  },
  {
    tag: "System Feature",
    title: "Digital Lost & Found",
    text: "Every report and claim is tracked in one secure record.",
    bg: "from-[#D4EFE0] to-[#8FD0AE]",
    art: (
      <>
        <rect x="42" y="36" width="96" height="84" rx="10" />
        <path d="M60 62h60M60 82h60M60 102h36" />
        <path d="m104 100 8 8 16-18" />
      </>
    ),
  },
  {
    tag: "School Campaign",
    title: "Campus Honesty Drive",
    text: "Turn in what you find. Honesty keeps our school trusted.",
    bg: "from-[#CDEBDA] to-[#7FC59F]",
    art: (
      <>
        <path d="M90 36c0 0-40 14-40 44 0 26 20 40 40 48 20-8 40-22 40-48 0-30-40-44-40-44z" />
        <path d="m72 82 14 14 24-28" />
      </>
    ),
  },
  {
    tag: "School Campaign",
    title: "Return-to-Owner Week",
    text: "A week to reunite every unclaimed item with its owner.",
    bg: "from-[#DDF3E8] to-[#97D6B4]",
    art: (
      <>
        <rect x="40" y="62" width="100" height="62" rx="8" />
        <path d="M40 82h100M90 62v62" />
        <path d="M90 62c-14-26-38-22-30-6 4 8 18 6 30 6zM90 62c14-26 38-22 30-6-4 8-18 6-30 6z" />
      </>
    ),
  },
];

export default function HeroCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 4500);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div
      className="relative w-full max-w-sm h-[360px] mx-auto md:mx-0 rounded-3xl overflow-hidden shadow-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((s, idx) => (
        <div
          key={s.title}
          aria-hidden={idx !== i}
          className={`absolute inset-0 bg-gradient-to-b ${s.bg} transition-opacity duration-700 ease-in-out ${idx === i ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <svg viewBox="0 0 180 150" className="absolute top-5 left-1/2 -translate-x-1/2 w-40 h-32 text-[#0E4D34]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {s.art}
          </svg>
          <div className="absolute inset-x-4 bottom-10 bg-white/85 backdrop-blur-sm rounded-2xl p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-[#2FA36B]">{s.tag}</p>
            <p className="text-[#0E4D34] font-black text-lg leading-tight mt-1">{s.title}</p>
            <p className="text-[#1E3F2E] text-sm leading-snug mt-1.5">{s.text}</p>
          </div>
        </div>
      ))}

      <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2.5">
        {SLIDES.map((s, idx) => (
          <button
            key={s.title}
            onClick={() => setI(idx)}
            aria-label={`Show slide ${idx + 1}`}
            className={`h-3 rounded-full transition-all ${idx === i ? "w-8 bg-[#0E4D34]" : "w-3 bg-[#0E4D34]/35 hover:bg-[#0E4D34]/60"}`}
          />
        ))}
      </div>
    </div>
  );
}