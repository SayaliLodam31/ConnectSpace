'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  MonitorUp,
  MessageSquare,
  PenTool,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openCookieSettings } from '@/components/ui/cookie-banner';

export default function HomePage() {
  const router = useRouter();
  const [meetingCode, setMeetingCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = meetingCode.trim();
    if (code) {
      setIsJoining(true);
      router.push(`/meetings/${code}`);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Navigation Header */}
      <header className="h-20 border-b border-slate-100 px-6 sm:px-12 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">ConnectSpace</span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="shadow-md shadow-blue-500/20">
              Get Started Free
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6 sm:px-12 max-w-6xl mx-auto text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-semibold mb-6 shadow-subtle">
          <Zap className="w-3.5 h-3.5 text-blue-600" />
          <span>Real-Time WebRTC & Supabase Enterprise Collaboration</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl leading-tight">
          Seamless Video Meetings & Dynamic Collaboration in One Space
        </h1>

        <p className="text-lg text-slate-600 max-w-2xl mt-6 leading-relaxed">
          High-fidelity peer-to-peer audio and video, ultra-low latency screen sharing, instant synchronized chat, interactive whiteboards, and encrypted file sharing.
        </p>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10 w-full max-w-md">
          <Link href="/dashboard" className="w-full sm:w-auto flex-1">
            <Button size="lg" className="w-full shadow-lg shadow-blue-600/20 text-base">
              Open Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>

          <form onSubmit={handleJoin} className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <input
              type="text"
              placeholder="Enter meeting code..."
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
            />
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              isLoading={isJoining}
              disabled={!meetingCode.trim() || isJoining}
            >
              {isJoining ? 'Joining...' : 'Join'}
            </Button>
          </form>
        </div>

        <div className="flex items-center gap-6 mt-8 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> No downloads required
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Encrypted WebRTC
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Supabase Realtime
          </span>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-16 px-6 sm:px-12 bg-slate-50 border-t border-slate-200/80">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Engineered for High-Productivity Teams
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              All the tools you need for modern remote work without friction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-elevated transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Real WebRTC Mesh Calling</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Direct browser-to-browser media mesh with automatic SDP exchange, ICE negotiation, camera and microphone toggles, and active speaker focus.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-elevated transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <PenTool className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Collaborative Whiteboard</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Multi-user canvas with freehand pen, shapes, text, eraser, and color pickers synchronized live across every participant via Supabase Realtime.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-elevated transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Secure Storage & RLS</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Row Level Security on all tables with private storage bucket file sharing via signed URLs, strictly scoped to meeting participants.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 py-8 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>© 2026 ConnectSpace Inc. Built with Next.js, Supabase, and WebRTC.</p>
        <div className="flex items-center gap-6">
          <button
            onClick={openCookieSettings}
            className="hover:text-blue-600 font-medium transition-colors cursor-pointer"
          >
            Cookie Preferences
          </button>
        </div>
      </footer>
    </div>
  );
}
