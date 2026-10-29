'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Video, Plus, Bell, Search, Menu, X, LayoutDashboard, CalendarPlus, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/ui/avatar';
import { generateMeetingCode, cn } from '@/lib/utils';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { Profile } from '@/types/database';

interface TopbarProps {
  userProfile?: Profile | null;
}

export function Topbar({ userProfile }: TopbarProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { success, error } = useToast();

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [meetingCodeInput, setMeetingCodeInput] = useState('');
  const [isCreatingInstant, setIsCreatingInstant] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleStartInstant = async () => {
    setIsCreatingInstant(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Ensure user profile exists in public.profiles to satisfy foreign keys
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: userProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team Member',
          email: user.email,
          avatar_url: userProfile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email || user.id)}`,
          status: 'online',
        },
        { onConflict: 'id' }
      );

      const code = generateMeetingCode();
      const { data, error: dbError } = await supabase
        .from('meetings')
        .insert({
          host_id: user.id,
          title: `${userProfile?.full_name || 'My'} Instant Space`,
          description: 'Instant ad-hoc collaboration meeting',
          meeting_code: code,
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) throw dbError;

      success('Meeting Created', `Meeting code: ${code}`);
      router.push(`/meetings/${data.id}`);
    } catch (err: any) {
      const msg = err.message?.includes('PGRST205') || err.message?.includes("table 'public.meetings'")
        ? "Database tables not found in Supabase. Please execute the migration in supabase/migrations/20261021000001_consolidated_schema.sql in your Supabase SQL Editor."
        : (err.message || 'Please check your connection');
      error('Could not create meeting', msg);
    } finally {
      setIsCreatingInstant(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = meetingCodeInput.trim().toLowerCase();
    if (!cleanCode) return;

    // Check if code contains full URL or just the code
    let code = cleanCode;
    if (code.includes('/meetings/')) {
      code = code.split('/meetings/').pop()?.split('?')[0] || code;
    }

    setIsJoining(true);
    setJoinModalOpen(false);
    router.push(`/meetings/${code}`);
  };

  const pathname = usePathname();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Meetings', href: '/meetings', icon: Video },
    { label: 'New Meeting', href: '/meetings/new', icon: CalendarPlus },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
        {/* Mobile menu trigger */}
        <div className="flex items-center gap-3 lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile navigation"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-slate-900 tracking-tight">ConnectSpace</span>
        </div>

        {/* Search or Quick Join */}
        <div className="hidden md:flex items-center gap-3 max-w-md w-full">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search or enter meeting code..."
              value={meetingCodeInput}
              onChange={(e) => setMeetingCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoinByCode(e);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
            />
          </div>
          {meetingCodeInput && (
            <Button size="sm" onClick={handleJoinByCode} isLoading={isJoining} disabled={isJoining} variant="secondary">
              {isJoining ? 'Joining...' : 'Join'}
            </Button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setJoinModalOpen(true)}
            className="hidden sm:inline-flex"
          >
            Join Meeting
          </Button>

          <Button
            size="sm"
            onClick={handleStartInstant}
            isLoading={isCreatingInstant}
            disabled={isCreatingInstant}
            className="shadow-sm shadow-blue-600/20"
          >
            <Video className="w-4 h-4 mr-1.5" />
            {isCreatingInstant ? 'Creating Space...' : 'New Meeting'}
          </Button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200/90 shadow-lg px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-150">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-blue-600' : 'text-slate-400')} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar
                src={userProfile?.avatar_url}
                name={userProfile?.full_name || userProfile?.email || 'User'}
                size="sm"
                status={userProfile?.status || 'online'}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {userProfile?.full_name || 'My Account'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {userProfile?.email || 'user@connectspace.io'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-red-600 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Join Meeting Modal */}
      <Modal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title="Join a Meeting"
        description="Enter the meeting code or link shared by the host."
      >
        <form onSubmit={handleJoinByCode} className="space-y-4">
          <Input
            label="Meeting Code or URL"
            placeholder="e.g. abc-defg-hij or paste full link"
            value={meetingCodeInput}
            onChange={(e) => setMeetingCodeInput(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setJoinModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isJoining} disabled={!meetingCodeInput.trim() || isJoining}>
              {isJoining ? 'Joining Space...' : 'Join Space'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
