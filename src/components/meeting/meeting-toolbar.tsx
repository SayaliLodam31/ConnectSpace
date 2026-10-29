'use client';

import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  MessageSquare,
  Users,
  FolderOpen,
  PenTool,
  PhoneOff,
  Info,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface MeetingToolbarProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  activePanel: 'chat' | 'participants' | 'files' | 'whiteboard' | null;
  unreadMessagesCount?: number;
  participantsCount?: number;
  isHost?: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onTogglePanel: (panel: 'chat' | 'participants' | 'files' | 'whiteboard') => void;
  onShowInfo: () => void;
  onLeaveMeeting: () => void;
  onEndMeeting?: () => void;
}

export function MeetingToolbar({
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  activePanel,
  unreadMessagesCount = 0,
  participantsCount = 1,
  isHost = false,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onTogglePanel,
  onShowInfo,
  onLeaveMeeting,
  onEndMeeting,
}: MeetingToolbarProps) {
  return (
    <footer className="h-20 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 sm:px-8 flex items-center justify-between gap-2 shadow-floating z-30 select-none">
      {/* Left: Meeting Info Button */}
      <div className="flex items-center gap-2 min-w-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onShowInfo}
          className="rounded-xl hidden sm:inline-flex"
        >
          <Info className="w-4 h-4 mr-1.5 text-blue-600" />
          <span>Meeting Info</span>
        </Button>
      </div>

      {/* Center: Core Call Controls (Mic, Cam, Screen, Whiteboard) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Microphone Toggle */}
        <button
          onClick={onToggleAudio}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={cn(
            'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-150 shadow-subtle',
            isMuted
              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 ring-2 ring-red-500/20'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
          )}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Video Toggle */}
        <button
          onClick={onToggleVideo}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          className={cn(
            'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-150 shadow-subtle',
            !isVideoEnabled
              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 ring-2 ring-red-500/20'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
          )}
        >
          {!isVideoEnabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Stop screen share' : 'Share your screen'}
          className={cn(
            'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-150 shadow-subtle',
            isScreenSharing
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md ring-2 ring-blue-500/30'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
          )}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
        </button>

        {/* Collaborative Whiteboard Toggle */}
        <button
          onClick={() => onTogglePanel('whiteboard')}
          title="Collaborative Whiteboard"
          className={cn(
            'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-150 shadow-subtle',
            activePanel === 'whiteboard'
              ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-500/30'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
          )}
        >
          <PenTool className="w-5 h-5" />
        </button>
      </div>

      {/* Right: Panels and Leave Call */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Chat Toggle */}
        <button
          onClick={() => onTogglePanel('chat')}
          title="Meeting Chat"
          className={cn(
            'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150',
            activePanel === 'chat'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          )}
        >
          <MessageSquare className="w-5 h-5" />
          {unreadMessagesCount > 0 && activePanel !== 'chat' && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
            </span>
          )}
        </button>

        {/* Participants Toggle */}
        <button
          onClick={() => onTogglePanel('participants')}
          title="Participants"
          className={cn(
            'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150',
            activePanel === 'participants'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          )}
        >
          <Users className="w-5 h-5" />
          {participantsCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
              {participantsCount}
            </span>
          )}
        </button>

        {/* Shared Files Toggle */}
        <button
          onClick={() => onTogglePanel('files')}
          title="Shared Files"
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150',
            activePanel === 'files'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          )}
        >
          <FolderOpen className="w-5 h-5" />
        </button>

        {/* Leave or End Call */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
          <Button
            size="sm"
            variant="danger"
            onClick={onLeaveMeeting}
            className="rounded-xl px-3 sm:px-4"
          >
            <PhoneOff className="w-4 h-4 mr-1.5" />
            <span>Leave</span>
          </Button>

          {isHost && onEndMeeting && (
            <Button
              size="sm"
              variant="outline"
              onClick={onEndMeeting}
              className="text-red-600 border-red-200 hover:bg-red-50 rounded-xl text-xs px-2.5 hidden md:inline-flex"
            >
              End for all
            </Button>
          )}
        </div>
      </div>
    </footer>
  );
}
