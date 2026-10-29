'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Clock, Copy, ExternalLink, Trash2, Users } from 'lucide-react';
import { Meeting } from '@/types/database';
import { StatusBadge } from '@/components/ui/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface MeetingCardProps {
  meeting: Meeting;
  currentUserId?: string;
  onDelete?: (meetingId: string) => void;
}

export function MeetingCard({ meeting, currentUserId, onDelete }: MeetingCardProps) {
  const { success } = useToast();
  const isHost = currentUserId === meeting.host_id;

  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/meetings/${meeting.meeting_code}`;
    navigator.clipboard.writeText(link);
    success('Meeting Link Copied', 'Share this link with your teammates.');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(meeting.meeting_code);
    success('Meeting Code Copied', meeting.meeting_code);
  };

  const formattedDate = meeting.scheduled_start
    ? new Date(meeting.scheduled_start).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : new Date(meeting.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

  const formattedTime = meeting.scheduled_start
    ? new Date(meeting.scheduled_start).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date(meeting.created_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-elevated transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Header: Title and Status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
              {meeting.title}
            </h4>
            {meeting.description && (
              <p className="text-xs text-slate-500 line-clamp-2 mt-1">{meeting.description}</p>
            )}
          </div>
          <StatusBadge status={meeting.status} />
        </div>

        {/* Meeting Code Badge */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/70 rounded-lg text-xs font-mono text-slate-600 my-2">
          <span>{meeting.meeting_code}</span>
          <button
            onClick={handleCopyCode}
            title="Copy code"
            className="hover:text-slate-900 transition-colors p-0.5 rounded"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Date and Time info */}
        <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formattedTime}</span>
          </div>
        </div>

        {/* Host Info */}
        <div className="flex items-center gap-2.5 pt-4 mt-4 border-t border-slate-100">
          <Avatar
            src={meeting.host?.avatar_url}
            name={meeting.host?.full_name || 'Host'}
            size="xs"
          />
          <span className="text-xs text-slate-600 truncate">
            Hosted by <strong className="font-medium text-slate-800">{isHost ? 'You' : meeting.host?.full_name || 'Host'}</strong>
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyLink}
            title="Copy invitation link"
            className="px-2"
          >
            <Copy className="w-4 h-4 text-slate-500" />
          </Button>

          {isHost && onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(meeting.id)}
              title="Delete meeting"
              className="px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        <Link href={`/meetings/${meeting.id}`}>
          <Button
            size="sm"
            variant={meeting.status === 'active' ? 'primary' : 'outline'}
            className="shadow-sm"
          >
            {meeting.status === 'active' ? 'Join Now' : 'Enter Room'}
            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
