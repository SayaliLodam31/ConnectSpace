'use client';

import React from 'react';
import {
  Users,
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  UserX,
  Crown,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { MeetingParticipant, Profile } from '@/types/database';
import { Button } from '@/components/ui/button';

interface ParticipantsPanelProps {
  participants: MeetingParticipant[];
  currentUserId: string;
  isHost: boolean;
  onClose: () => void;
  onMuteParticipant?: (userId: string) => void;
  onRemoveParticipant?: (userId: string) => void;
}

export function ParticipantsPanel({
  participants,
  currentUserId,
  isHost,
  onClose,
  onMuteParticipant,
  onRemoveParticipant,
}: ParticipantsPanelProps) {
  return (
    <div className="w-80 sm:w-96 bg-white border-l border-slate-200/80 flex flex-col h-full shadow-card z-20">
      {/* Header */}
      <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-slate-900">
            Participants ({participants.length})
          </h4>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Participant List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2">
        {participants.map((p) => {
          const isMe = p.user_id === currentUserId;
          const isParticipantHost = p.role === 'host';

          return (
            <div
              key={p.id || p.user_id}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-slate-100/80 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  src={p.profile?.avatar_url}
                  name={p.profile?.full_name || p.profile?.email || 'Participant'}
                  size="sm"
                  status="online"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {p.profile?.full_name || p.profile?.email || 'Participant'}
                    </p>
                    {isMe && <span className="text-[10px] text-slate-400 font-normal">(You)</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isParticipantHost ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 font-semibold">
                        <Crown className="w-3 h-3" /> Host
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 capitalize">{p.role}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Icons & Host Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {p.is_screen_sharing && (
                  <span title="Screen sharing" className="text-blue-600">
                    <MonitorUp className="w-3.5 h-3.5" />
                  </span>
                )}

                <span
                  title={p.is_video_enabled ? 'Camera on' : 'Camera off'}
                  className={p.is_video_enabled ? 'text-slate-600' : 'text-slate-300'}
                >
                  {p.is_video_enabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                </span>

                <span
                  title={p.is_muted ? 'Muted' : 'Speaking/Unmuted'}
                  className={p.is_muted ? 'text-red-500' : 'text-emerald-500'}
                >
                  {p.is_muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </span>

                {isHost && !isMe && (
                  <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onMuteParticipant && !p.is_muted && (
                      <button
                        onClick={() => onMuteParticipant(p.user_id)}
                        title="Mute participant"
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <MicOff className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onRemoveParticipant && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${p.profile?.full_name || 'this participant'} from the meeting?`)) {
                            onRemoveParticipant(p.user_id);
                          }
                        }}
                        title="Remove participant"
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
