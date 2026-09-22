"use client";

import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <main className="min-h-screen bg-[#fafbff] font-sans overflow-x-hidden scroll-smooth">

      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-[#1a237e] mb-1">Welcome Back</h2>
              <p className="text-gray-400 text-sm">Choose your account type to continue</p>
            </div>

            <div className="space-y-4">
              <a
                href="/login"
                className="flex items-center gap-4 w-full border-2 border-[#1a237e]/20 hover:border-[#1a237e] hover:bg-[#1a237e]/5 rounded-2xl p-4 transition-all duration-200 group"
              >
                <div className="w-12 h-12 bg-[#1a237e] rounded-xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-black text-[#1a237e] text-base">Super Admin</p>
                  <p className="text-gray-400 text-xs">CCI IT Coordinator — Full system access</p>
                </div>
                <span className="ml-auto text-[#1a237e]/40 group-hover:text-[#1a237e] text-xl transition">→</span>
              </a>

              <a
                href="/admin-login"
                className="flex items-center gap-4 w-full border-2 border-[#ffd700]/40 hover:border-[#ffd700] hover:bg-[#ffd700]/5 rounded-2xl p-4 transition-all duration-200 group"
              >
                <div className="w-12 h-12 bg-[#ffd700] rounded-xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#1a237e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-black text-[#1a237e] text-base">Admin</p>
                  <p className="text-gray-400 text-xs">Guidance Counselor — Manage items &amp; claims</p>
                </div>
                <span className="ml-auto text-[#ffd700]/60 group-hover:text-[#ffd700] text-xl transition">→</span>
              </a>

              <a
                href="/student-login"
                className="flex items-center gap-4 w-full border-2 border-red-400/30 hover:border-red-500 hover:bg-red-50 rounded-2xl p-4 transition-all duration-200 group"
              >
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-black text-[#1a237e] text-base">Student</p>
                  <p className="text-gray-400 text-xs">Report &amp; track lost or found items</p>
                </div>
                <span className="ml-auto text-red-400/60 group-hover:text-red-500 text-xl transition">→</span>
              </a>
            </div>

            <p className="text-center text-gray-400 text-xs mt-6">
              Not sure which to pick? Contact your school administrator.
            </p>
          </div>
        </div>
      )}

      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-4 bg-[#1a237e]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <a href="/" className="text-xl font-black text-white tracking-wide hover:opacity-80 transition">
            FIND<span className="text-[#ffd700]">NEST</span>
          </a>
        </div>
        <div className="flex items-center gap-10">
          <a href="/" className="text-blue-200 hover:text-[#ffd700] transition font-medium text-sm tracking-wide">HOME</a>
          <button onClick={() => setShowLoginModal(true)} className="text-blue-200 hover:text-[#ffd700] transition font-medium text-sm tracking-wide">LOST</button>
          <button onClick={() => setShowLoginModal(true)} className="text-blue-200 hover:text-[#ffd700] transition font-medium text-sm tracking-wide">FOUND</button>
          <button
            onClick={() => setShowLoginModal(true)}
            className="bg-[#ffd700] text-[#1a237e] font-bold px-6 py-2 rounded-full hover:bg-yellow-300 transition shadow-md text-sm"
          >
            LOG IN
          </button>
        </div>
      </nav>

      <section className="relative min-h-screen flex items-center overflow-hidden pt-20">

        <div className="absolute inset-0 bg-[#fafbff]" />
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-gradient-to-br from-[#1a237e] to-[#3949ab] rounded-full opacity-90" />
        <div className="absolute top-1/3 -right-10 w-80 h-80 bg-[#ffd700]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-full h-2/3 bg-gradient-to-t from-[#1a237e]/5 to-transparent" />
        <div className="absolute bottom-20 left-10 w-40 h-40 border-4 border-[#ffd700]/20 rounded-3xl rotate-12" />
        <div className="absolute top-40 left-1/3 w-6 h-6 bg-red-400 rounded-full" />
        <div className="absolute bottom-1/3 right-1/4 w-4 h-4 bg-[#ffd700] rounded-full" />

        <div className="relative z-10 grid grid-cols-2 gap-12 px-20 w-full items-center">

          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-[#1a237e]/10 shadow-sm rounded-full px-4 py-2 mb-6">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[#1a237e] text-sm font-semibold">AI-Powered Lost &amp; Found System</span>
            </div>

            <h1 className="text-6xl font-black text-[#1a237e] leading-[1.05] mb-6">
              Never Lose
              <span className="block bg-gradient-to-r from-[#ffd700] to-[#f59e0b] bg-clip-text text-transparent">What Matters</span>
              Most.
            </h1>

            <p className="text-gray-500 text-lg mb-10 leading-relaxed max-w-md">
              FindNest uses advanced AI image recognition to match lost and found items on campus. Submit a report, get notified instantly.
            </p>

            <div className="flex gap-4 mb-12">
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-4 rounded-2xl transition shadow-xl shadow-red-500/20 hover:-translate-y-1"
              >
                Report Lost Item
              </button>
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 border-2 border-[#1a237e]/10 text-[#1a237e] font-bold px-8 py-4 rounded-2xl transition hover:-translate-y-1"
              >
                Found Something?
              </button>
            </div>

            <div className="flex gap-10">
              <div>
                <p className="text-3xl font-black text-[#1a237e]">675+</p>
                <p className="text-gray-400 text-sm">Students</p>
              </div>
              <div className="w-px bg-gray-200" />
              <div>
                <p className="text-3xl font-black text-[#1a237e]">AI</p>
                <p className="text-gray-400 text-sm">Powered Matching</p>
              </div>
              <div className="w-px bg-gray-200" />
              <div>
                <p className="text-3xl font-black text-[#1a237e]">24/7</p>
                <p className="text-gray-400 text-sm">Real-Time Alerts</p>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="absolute -inset-6 bg-gradient-to-br from-[#ffd700]/30 to-transparent rounded-[2.5rem] rotate-3" />

            <div className="relative w-80 bg-white rounded-[2rem] p-8 shadow-2xl shadow-[#1a237e]/10 border border-gray-100 flex flex-col items-center -rotate-2">
              <Image
                src="/images/findnest-logo.svg"
                alt="FindNest Logo"
                width={140}
                height={140}
                className="rounded-2xl mb-4"
                priority
              />
              <h3 className="text-[#1a237e] font-black text-lg text-center">SJDM Cornerstone</h3>
              <p className="text-gray-400 text-sm text-center mb-6">College Inc.</p>

              <div className="space-y-3 w-full">
                <div className="flex items-center gap-3 bg-[#f5f7ff] rounded-xl p-3">
                  <div>
                    <p className="text-[#1a237e] text-sm font-semibold">AI Image Matching</p>
                    <p className="text-gray-400 text-xs">Smart item recognition to instantly identify lost items and accelerate the recovery process!</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[#f5f7ff] rounded-xl p-3">
                  <div>
                    <p className="text-[#1a237e] text-sm font-semibold">Instant Notifications</p>
                    <p className="text-gray-400 text-xs">Real-time push alerts to keep users immediately informed whenever a matching item is found!</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[#f5f7ff] rounded-xl p-3">
                  <div>
                    <p className="text-[#1a237e] text-sm font-semibold">Claim Verification</p>
                    <p className="text-gray-400 text-xs">5-layer security check to ensure authenticity and prevent fraudulent claims!</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-5 -right-5 bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg rotate-6">
              Match Found!
            </div>
            <div className="absolute -bottom-5 -left-5 bg-[#1a237e] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg -rotate-6">
              Owner Notified!
            </div>
          </div>
        </div>
      </section>

      <section className="px-20 py-24 bg-white relative">
        <div className="text-center mb-16">
          <span className="text-[#ffd700] font-bold text-sm uppercase tracking-widest">The Process</span>
          <h2 className="text-4xl font-black text-[#1a237e] mt-2 mb-4">How FindNest Works</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">A smarter way to manage lost and found items on campus</p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="group relative text-center p-20 rounded-3xl bg-[#f5f7ff] hover:bg-[#1a237e] transition-all duration-300">
            <span className="absolute top-6 right-6 text-5xl font-black text-[#1a237e]/10 group-hover:text-white/10">01</span>
            <h3 className="font-black text-[#1a237e] group-hover:text-white text-xl mb-3 transition">Submit a Report</h3>
            <p className="text-gray-500 group-hover:text-blue-200 leading-relaxed transition">Upload a photo of your lost or found item. Our AI automatically detects item details.</p>
          </div>

          <div className="group relative text-center p-20 rounded-3xl bg-[#fff9e6] hover:bg-[#ffd700] transition-all duration-300">
            <span className="absolute top-6 right-6 text-5xl font-black text-[#1a237e]/10 group-hover:text-[#1a237e]/20">02</span>
            <h3 className="font-black text-[#1a237e] text-xl mb-3">AI Finds a Match</h3>
            <p className="text-gray-500 leading-relaxed">Our AI engine compares your report against all found items and finds potential matches instantly.</p>
          </div>

          <div className="group relative text-center p-20 rounded-3xl bg-red-50 hover:bg-red-500 transition-all duration-300">
            <span className="absolute top-6 right-6 text-5xl font-black text-red-500/10 group-hover:text-white/10">03</span>
            <h3 className="font-black text-[#1a237e] group-hover:text-white text-xl mb-3 transition">Claim Your Item</h3>
            <p className="text-gray-500 group-hover:text-red-100 leading-relaxed transition">Go through our secure 5-layer verification process and claim your belongings from the school office.</p>
          </div>
        </div>
      </section>

      <section id="about" className="px-20 py-24 bg-[#f5f7ff] scroll-mt-24">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#ffd700] font-bold text-sm uppercase tracking-widest">Who We Are</span>
          <h2 className="text-4xl font-black text-[#1a237e] mt-2 mb-6">About FindNest</h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-10">
            FindNest is a multi-platform lost and found record management system built specifically
            for the Junior High School, Senior High School, and College programs of SJDM Cornerstone
            College Inc. It replaces the school&apos;s manual, logbook-based process with a digital
            solution that uses AI-powered image recognition and description-based matching to help
            students recover their belongings faster and with less hassle.
          </p>

          <div className="grid grid-cols-3 gap-6 text-left">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-[#1a237e] mb-2">Our Purpose</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                To modernize the campus lost and found process with photo documentation, real-time
                tracking, and a searchable digital record for every reported item.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-[#1a237e] mb-2">Trust &amp; Security</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                A five-layer claim verification process protects students from fraudulent claims and
                ensures every recovered item goes back to its rightful owner.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-[#1a237e] mb-2">Built for SJDM</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Designed around the real needs of SJDM Cornerstone College Inc., gathered through
                direct surveys and interviews with students and school personnel.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-20 py-24 bg-white scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#ffd700] font-bold text-sm uppercase tracking-widest">Step by Step</span>
            <h2 className="text-4xl font-black text-[#1a237e] mt-2 mb-4">How It Works</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Here&apos;s a closer look at how FindNest takes an item from &quot;lost&quot; to &quot;returned&quot;.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-6 items-start bg-[#f5f7ff] rounded-2xl p-6">
              <div className="w-10 h-10 shrink-0 bg-[#1a237e] text-white rounded-full flex items-center justify-center font-black">1</div>
              <div>
                <h3 className="font-black text-[#1a237e] mb-1">Report with a Photo</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  A student submits a lost or found item report with a required photo. The system
                  checks image quality and content, then the AI pre-fills details like category,
                  color, and fine features such as scratches or stickers.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start bg-[#fff9e6] rounded-2xl p-6">
              <div className="w-10 h-10 shrink-0 bg-[#ffd700] text-[#1a237e] rounded-full flex items-center justify-center font-black">2</div>
              <div>
                <h3 className="font-black text-[#1a237e] mb-1">AI-Powered Matching</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  As soon as a report is saved, the AI automatically compares it against existing
                  records in both directions — new lost reports against approved found items, and
                  newly approved found items against active lost reports — flagging matches above
                  the confidence threshold.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start bg-red-50 rounded-2xl p-6">
              <div className="w-10 h-10 shrink-0 bg-red-500 text-white rounded-full flex items-center justify-center font-black">3</div>
              <div>
                <h3 className="font-black text-[#1a237e] mb-1">Instant Notification</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  The student is notified the moment a likely match is found, so there&apos;s no need
                  to keep checking the office in person or wait for a flag ceremony announcement.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start bg-[#f5f7ff] rounded-2xl p-6">
              <div className="w-10 h-10 shrink-0 bg-[#1a237e] text-white rounded-full flex items-center justify-center font-black">4</div>
              <div>
                <h3 className="font-black text-[#1a237e] mb-1">Five-Layer Claim Verification</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Before releasing any item, an administrator reviews verified student identity,
                  submitted evidence, the AI similarity score, and secret question results — no
                  single factor decides ownership on its own.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start bg-[#fff9e6] rounded-2xl p-6">
              <div className="w-10 h-10 shrink-0 bg-[#ffd700] text-[#1a237e] rounded-full flex items-center justify-center font-black">5</div>
              <div>
                <h3 className="font-black text-[#1a237e] mb-1">Item Returned &amp; Logged</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Once ownership is confirmed, the item is marked as returned and the full
                  transaction — evidence, scores, and the approving admin — is permanently stored in
                  a tamper-evident audit trail.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-20 py-24 bg-[#1a237e] overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-[#ffd700]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-red-500/10 rounded-full blur-3xl" />
        <div className="relative text-center">
          <h2 className="text-4xl font-black text-white mb-4">Lost Something on Campus?</h2>
          <p className="text-blue-200 text-lg mb-10">Report it now and let our AI do the work for you.</p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="bg-[#ffd700] text-[#1a237e] font-black px-10 py-4 rounded-2xl hover:bg-yellow-300 transition shadow-xl text-lg"
          >
            Get Started Now
          </button>
        </div>
      </section>

      <footer className="bg-[#0d1757] px-20 py-12">
        <div className="flex justify-between items-start">
          <div className="max-w-xs">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl font-black text-white">
                FIND<span className="text-[#ffd700]">NEST</span>
              </span>
            </div>
            <p className="text-blue-300 text-sm leading-relaxed">
              A Multi-Platform Lost & Found Record Management System with Image Recognition & Description Based Matching and Claim Verification for San Jose Del Monte Cornerstone College Inc.
            </p>
          </div>
          <div>
            <p className="font-bold mb-4 text-[#ffd700] text-sm tracking-wide uppercase">Site</p>
            <button onClick={() => setShowLoginModal(true)} className="block text-blue-300 text-sm hover:text-white mb-2">Lost Items</button>
            <button onClick={() => setShowLoginModal(true)} className="block text-blue-300 text-sm hover:text-white mb-2">Found Items</button>
            <button onClick={() => setShowLoginModal(true)} className="block text-blue-300 text-sm hover:text-white mb-2">Report Item</button>
          </div>
          <div>
            <p className="font-bold mb-4 text-[#ffd700] text-sm tracking-wide uppercase">Help</p>
            <a href="#about" className="block text-blue-300 text-sm hover:text-white mb-2">About FindNest</a>
            <a href="#how-it-works" className="block text-blue-300 text-sm hover:text-white mb-2">How It Works</a>
          </div>
          <div>
            <p className="font-bold mb-4 text-[#ffd700] text-sm tracking-wide uppercase">Connect</p>
            <a
              href="https://www.facebook.com/sjdmcci.2023"
              className="block text-blue-300 text-sm hover:text-white mb-2 transition-colors"
              target="_blank"
              rel="noopener noreferrer">
                Facebook
            </a>
          </div>
          <div>
            <p className="font-bold mb-4 text-[#ffd700] text-sm tracking-wide uppercase">Contact</p>
            <p className="text-blue-300 text-sm mb-2">0917 700 4758</p>
            <p className="text-blue-300 text-sm">sjdmcornerstonecollege.inc@gmail.com</p>
          </div>
        </div>
        <div className="border-t border-white/10 mt-10 pt-6 text-center">
          <p className="text-blue-400 text-sm">© 2026 FindNest — SJDM Cornerstone College Inc. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}