'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, Mail, Plus, X, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { generateMeetingCode } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export default function NewMeetingPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { success, error: toastError } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddInviteEmail = () => {
    const email = inviteEmailInput.trim().toLowerCase();
    if (email && email.includes('@') && !invitedEmails.includes(email)) {
      setInvitedEmails((prev) => [...prev, email]);
      setInviteEmailInput('');
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setInvitedEmails((prev) => prev.filter((e) => e !== emailToRemove));
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toastError('Validation Error', 'Please provide a title for the meeting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Ensure host profile exists in public.profiles to satisfy foreign keys
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team Member',
          email: user.email,
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email || user.id)}`,
          status: 'online',
        },
        { onConflict: 'id' }
      );

      const meetingCode = generateMeetingCode();

      let scheduledStart: string | null = null;
      if (scheduledDate && scheduledTime) {
        scheduledStart = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      // 1. Create meeting record
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          host_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          meeting_code: meetingCode,
          status: 'scheduled',
          scheduled_start: scheduledStart,
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // 2. Insert invitations if any
      if (invitedEmails.length > 0) {
        const invitations = invitedEmails.map((email) => ({
          meeting_id: meeting.id,
          inviter_id: user.id,
          invitee_email: email,
          status: 'pending',
        }));

        await supabase.from('meeting_invitations').insert(invitations);
      }

      success('Meeting Scheduled', `Meeting code: ${meetingCode}`);
      router.push(`/meetings`);
    } catch (err: any) {
      const msg = err.message?.includes('PGRST205') || err.message?.includes("table 'public.meetings'")
        ? "Database tables not found in Supabase. Please execute the migration in supabase/migrations/20261021000001_consolidated_schema.sql in your Supabase SQL Editor."
        : (err.message || 'Please check your inputs.');
      toastError('Could not create meeting', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link href="/meetings" className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Meetings
          </Link>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Schedule a Collaboration Space</h2>
            <p className="text-xs text-slate-500 mt-1">
              Set up a structured meeting with agenda, scheduled time, and email invitations
            </p>
          </div>

          <form onSubmit={handleCreateMeeting} className="space-y-5">
            <Input
              label="Meeting Title *"
              placeholder="e.g. Sprint Planning & Retrospective"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isSubmitting}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Description / Agenda
              </label>
              <textarea
                placeholder="What will you discuss in this meeting?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-subtle disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                disabled={isSubmitting}
              />
              <Input
                label="Time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Invite Attendees */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Invite Teammates by Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmailInput}
                  onChange={(e) => setInviteEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInviteEmail();
                    }
                  }}
                  className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-subtle"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddInviteEmail}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>

              {invitedEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {invitedEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200/60"
                    >
                      <Mail className="w-3 h-3 text-blue-500" />
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(email)}
                        className="text-blue-400 hover:text-blue-700 ml-1 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Link href="/meetings">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                isLoading={isSubmitting}
                disabled={isSubmitting || !title.trim()}
                className="shadow-md shadow-blue-600/20"
              >
                {isSubmitting ? 'Scheduling Space...' : 'Schedule Space'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
