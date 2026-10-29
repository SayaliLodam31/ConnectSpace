'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  Calendar,
  Plus,
  Users,
  Clock,
  ArrowRight,
  FolderOpen,
  Sparkles,
  Search,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { MeetingCard } from '@/components/meeting/meeting-card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { MeetingCardSkeleton } from '@/components/ui/loading-skeleton';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Meeting, Profile, MeetingFile } from '@/types/database';
import { generateMeetingCode, formatFileSize } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { success, error: toastError } = useToast();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [onlineTeammates, setOnlineTeammates] = useState<Profile[]>([]);
  const [recentFiles, setRecentFiles] = useState<MeetingFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingInstant, setIsCreatingInstant] = useState(false);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        // Fetch user profile
        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!profile) {
          // Fallback create profile if trigger hasn't completed
          const { data: newProfile } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
              email: user.email,
              avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                user.email || 'User'
              )}`,
              status: 'online',
            })
            .select()
            .single();
          profile = newProfile;
        }

        setCurrentUser(profile);

        // Fetch meetings
        const { data: meetingsData } = await supabase
          .from('meetings')
          .select(`
            *,
            host:profiles(*)
          `)
          .order('created_at', { ascending: false });

        if (meetingsData) {
          const upcoming = meetingsData.filter((m) => m.status === 'scheduled' || m.status === 'active');
          const recent = meetingsData.filter((m) => m.status === 'ended');
          setUpcomingMeetings(upcoming);
          setRecentMeetings(recent);
        }

        // Fetch teammates from profiles
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', user.id)
          .limit(8);

        if (profilesData) {
          setOnlineTeammates(profilesData);
        }

        // Fetch recent shared files
        const { data: filesData } = await supabase
          .from('meeting_files')
          .select(`
            *,
            uploader:profiles(*)
          `)
          .order('created_at', { ascending: false })
          .limit(5);

        if (filesData) {
          setRecentFiles(filesData);
        }
      } catch (err: any) {
        console.error('Error loading dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, [supabase, router]);

  const handleStartInstant = async () => {
    if (!currentUser) return;
    setIsCreatingInstant(true);
    try {
      // Ensure host profile exists in public.profiles to satisfy foreign keys
      await supabase.from('profiles').upsert(
        {
          id: currentUser.id,
          full_name: currentUser.full_name || 'Team Member',
          email: currentUser.email,
          avatar_url: currentUser.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.email || currentUser.id)}`,
          status: 'online',
        },
        { onConflict: 'id' }
      );

      const code = generateMeetingCode();
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          host_id: currentUser.id,
          title: `${currentUser.full_name || 'My'} Instant Space`,
          description: 'Instant collaboration space',
          meeting_code: code,
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      success('Meeting Created', `Meeting code: ${code}`);
      router.push(`/meetings/${data.id}`);
    } catch (err: any) {
      const msg = err.message?.includes('PGRST205') || err.message?.includes("table 'public.meetings'")
        ? "Database tables not found in Supabase. Please execute the migration in supabase/migrations/20261021000001_consolidated_schema.sql in your Supabase SQL Editor."
        : (err.message || 'Could not start instant meeting.');
      toastError('Error', msg);
    } finally {
      setIsCreatingInstant(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
      if (error) throw error;
      setUpcomingMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      setRecentMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      success('Meeting Deleted', 'The meeting has been cancelled.');
    } catch (err: any) {
      toastError('Could not delete', err.message);
    }
  };

  return (
    <AppShell userProfile={currentUser}>
      <div className="space-y-8">
        {/* Welcome Hero Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-3xl p-6 sm:p-8 text-white shadow-elevated relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Collaboration Hub</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {currentUser?.full_name?.split(' ')[0] || 'Teammate'}!
            </h2>
            <p className="text-sm text-blue-100 mt-2 leading-relaxed">
              Connect with your remote team instantly, run collaborative brainstorms on the whiteboard, or schedule future sessions.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Button
                onClick={handleStartInstant}
                isLoading={isCreatingInstant}
                className="bg-white text-blue-700 hover:bg-blue-50 shadow-md font-semibold border-none"
              >
                <Video className="w-4 h-4 mr-2 text-blue-600" />
                Start Instant Space
              </Button>

              <Link href="/meetings/new">
                <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Meeting
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Upcoming Meetings Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Upcoming & Active Meetings</h3>
              <p className="text-xs text-slate-500">Scheduled sessions ready to join or manage</p>
            </div>
            <Link href="/meetings">
              <span className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center">
                View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </span>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <MeetingCardSkeleton />
              <MeetingCardSkeleton />
              <MeetingCardSkeleton />
            </div>
          ) : upcomingMeetings.length === 0 ? (
            <EmptyState
              icon={Video}
              title="No upcoming meetings"
              description="Schedule a team catch-up or launch an instant room right away."
              actionLabel="Schedule Meeting"
              onAction={() => router.push('/meetings/new')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {upcomingMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  currentUserId={currentUser?.id}
                  onDelete={handleDeleteMeeting}
                />
              ))}
            </div>
          )}
        </section>

        {/* Two Column Layout: Teammates & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teammates Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-slate-900">Workspace Teammates</h4>
              </div>
              <span className="text-xs text-slate-400">{onlineTeammates.length} members</span>
            </div>

            {onlineTeammates.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No other members registered yet.</p>
            ) : (
              <div className="space-y-3">
                {onlineTeammates.map((teammate) => (
                  <div key={teammate.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        src={teammate.avatar_url}
                        name={teammate.full_name || teammate.email || 'User'}
                        size="sm"
                        status={teammate.status}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {teammate.full_name || teammate.email}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {teammate.job_title || 'Team Member'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Files Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-slate-900">Recent Meeting Files</h4>
              </div>
            </div>

            {recentFiles.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No shared files yet"
                description="Upload files inside meeting rooms to collaborate securely."
                className="border-none py-8"
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {recentFiles.map((file) => (
                  <div key={file.id} className="py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-xs font-semibold text-slate-900 truncate">{file.file_name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>•</span>
                        <span>Uploaded by {file.uploader?.full_name || 'Teammate'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(file.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
