'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Video, Plus, Search, Filter, CalendarPlus } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { MeetingCard } from '@/components/meeting/meeting-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MeetingCardSkeleton } from '@/components/ui/loading-skeleton';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Meeting, Profile } from '@/types/database';
import { useToast } from '@/components/ui/toast';

export default function MeetingsPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { success, error: toastError } = useToast();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'ended'>('all');

  useEffect(() => {
    async function loadMeetings() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setCurrentUser(profile);

        const { data: meetingsData } = await supabase
          .from('meetings')
          .select(`
            *,
            host:profiles(*)
          `)
          .order('created_at', { ascending: false });

        if (meetingsData) {
          setMeetings(meetingsData as Meeting[]);
        }
      } catch (err) {
        console.error('Error fetching meetings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMeetings();
  }, [supabase, router]);

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
      if (error) throw error;
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      success('Meeting Deleted', 'The meeting has been removed.');
    } catch (err: any) {
      toastError('Error', err.message || 'Could not delete meeting.');
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.meeting_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell userProfile={currentUser}>
      <div className="space-y-6">
        {/* Header with Title and Create Meeting Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Meetings</h2>
            <p className="text-xs text-slate-500 mt-1">
              Browse your upcoming sessions, launch ad-hoc rooms, or manage recorded activity
            </p>
          </div>

          <Link href="/meetings/new">
            <Button size="md" className="shadow-md shadow-blue-600/20">
              <CalendarPlus className="w-4 h-4 mr-2" />
              Schedule New Meeting
            </Button>
          </Link>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-subtle">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title or meeting code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            {(['all', 'active', 'scheduled', 'ended'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors capitalize ${
                  statusFilter === st
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/80'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'all' ? 'All Spaces' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Meetings Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
          </div>
        ) : filteredMeetings.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No meetings found"
            description={
              searchQuery
                ? 'Try adjusting your search criteria or filter options.'
                : 'You have no scheduled meetings yet.'
            }
            actionLabel="Schedule Meeting"
            onAction={() => router.push('/meetings/new')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                currentUserId={currentUser?.id}
                onDelete={handleDeleteMeeting}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
