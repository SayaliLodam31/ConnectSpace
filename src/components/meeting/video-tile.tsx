'use client';

import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, MonitorUp, Pin, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

export interface VideoTileProps {
  stream?: MediaStream | null;
  participantName: string;
  avatarUrl?: string | null;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  isScreenSharing?: boolean;
  isHost?: boolean;
  connectionState?: RTCPeerConnectionState;
  isActiveSpeaker?: boolean;
  onPin?: () => void;
  isPinned?: boolean;
}

export function VideoTile({
  stream,
  participantName,
  avatarUrl,
  isLocal = false,
  isMuted = false,
  isVideoEnabled = true,
  isScreenSharing = false,
  isHost = false,
  connectionState,
  isActiveSpeaker = false,
  onPin,
  isPinned = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideoTrack = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
  const shouldShowVideo = isVideoEnabled && hasVideoTrack;

  return (
    <div
      className={cn(
        'relative bg-slate-100 rounded-2xl overflow-hidden border transition-all duration-200 flex items-center justify-center min-h-[220px] aspect-video group shadow-card',
        isActiveSpeaker ? 'ring-2 ring-blue-500 border-blue-400' : 'border-slate-200/80',
        isPinned ? 'ring-2 ring-indigo-500' : ''
      )}
    >
      {/* Actual WebRTC Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Always mute local video to prevent audio feedback
        className={cn(
          'w-full h-full object-cover transition-opacity duration-200',
          shouldShowVideo ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none',
          isLocal && !isScreenSharing ? '-scale-x-100' : '' // Mirror local webcam only
        )}
      />

      {/* Avatar Fallback when Video is Turned Off */}
      {!shouldShowVideo && (
        <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <Avatar
            src={avatarUrl}
            name={participantName}
            size="xl"
            className="mb-3 ring-4 ring-white shadow-card"
          />
          <h5 className="text-sm font-semibold text-slate-800">{participantName}</h5>
          {connectionState && connectionState !== 'connected' && !isLocal && (
            <span className="text-[11px] text-amber-600 font-medium capitalize mt-1">
              {connectionState}...
            </span>
          )}
        </div>
      )}

      {/* Badges Overlay: Top Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5">
          {isScreenSharing && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600/90 text-white text-[11px] font-medium backdrop-blur-sm shadow-sm">
              <MonitorUp className="w-3 h-3" />
              Screen
            </span>
          )}
          {isHost && (
            <span className="px-2 py-0.5 rounded-md bg-indigo-600/90 text-white text-[11px] font-medium backdrop-blur-sm shadow-sm">
              Host
            </span>
          )}
        </div>

        {onPin && (
          <button
            onClick={onPin}
            className="pointer-events-auto p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin className={cn('w-3.5 h-3.5', isPinned && 'fill-white')} />
          </button>
        )}
      </div>

      {/* Name and Mic Status: Bottom Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/70 backdrop-blur-md text-white text-xs font-medium shadow-sm max-w-[80%] truncate">
          <span className="truncate">{participantName} {isLocal && '(You)'}</span>
        </div>

        <div
          className={cn(
            'p-1.5 rounded-xl backdrop-blur-md shadow-sm transition-colors',
            isMuted ? 'bg-red-500/90 text-white' : 'bg-slate-900/70 text-emerald-400'
          )}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
}
