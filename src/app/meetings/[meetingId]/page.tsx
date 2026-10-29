'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Sparkles,
  Copy,
  Check,
  PhoneOff,
  AlertCircle,
  Users,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Meeting, MeetingParticipant, Profile } from '@/types/database';
import { WebRTCManager, PeerMediaState } from '@/lib/webrtc/webrtc-manager';
import { VideoTile } from '@/components/meeting/video-tile';
import { MeetingToolbar } from '@/components/meeting/meeting-toolbar';
import { ChatPanel } from '@/components/meeting/chat-panel';
import { ParticipantsPanel } from '@/components/meeting/participants-panel';
import { FilePanel } from '@/components/meeting/file-panel';
import { WhiteboardPanel } from '@/components/meeting/whiteboard-panel';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export default function MeetingRoomPage() {
  const router = useRouter();
  const params = useParams();
  const meetingIdentifier = (params.meetingId as string) || '';
  const supabase = getSupabaseBrowserClient();
  const { success, error: toastError, info } = useToast();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [meetingNotFound, setMeetingNotFound] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // WebRTC States
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerStates, setPeerStates] = useState<Map<string, PeerMediaState>>(new Map());
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnectionState>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Active side panel
  const [activePanel, setActivePanel] = useState<'chat' | 'participants' | 'files' | 'whiteboard' | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Participants list & presence
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);

  // Ref to WebRTC Manager
  const rtcManagerRef = useRef<WebRTCManager | null>(null);

  // 1. Authenticate user & load meeting
  useEffect(() => {
    let isMounted = true;

    async function initRoom() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push(`/login?redirectTo=/meetings/${meetingIdentifier}`);
          return;
        }

        // Fetch or create profile
        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!profile) {
          const { data: newProfile } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
              email: user.email,
              avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email || 'User')}`,
              status: 'in_meeting',
            })
            .select()
            .single();
          profile = newProfile;
        } else {
          // Update status to in_meeting
          await supabase.from('profiles').update({ status: 'in_meeting' }).eq('id', user.id);
        }

        if (isMounted) setCurrentUser(profile);

        // Fetch meeting by either UUID or meeting_code
        let meetingQuery = supabase
          .from('meetings')
          .select(`
            *,
            host:profiles(*)
          `);

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meetingIdentifier);
        if (isUuid) {
          meetingQuery = meetingQuery.eq('id', meetingIdentifier);
        } else {
          meetingQuery = meetingQuery.eq('meeting_code', meetingIdentifier);
        }

        let meetingData: Meeting | null = null;
        const { data: directMeeting } = await meetingQuery.single();

        if (directMeeting) {
          meetingData = directMeeting as Meeting;
        } else {
          // Attempt authorized entry by meeting code RPC
          try {
            const { data: joinRes } = await supabase.rpc('join_meeting_by_code', {
              p_code: meetingIdentifier,
            });

            if (joinRes && (joinRes as any).success) {
              const { data: refetched } = await meetingQuery.single();
              if (refetched) {
                meetingData = refetched as Meeting;
              }
            }
          } catch (rpcErr) {
            console.warn('RPC join note:', rpcErr);
          }
        }

        if (!meetingData) {
          if (isMounted) {
            setMeetingNotFound(true);
            setIsLoading(false);
          }
          return;
        }

        if (meetingData.status === 'ended') {
          if (isMounted) {
            setMeetingEnded(true);
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setMeeting(meetingData as Meeting);
        }

        // Register participant record
        const { data: participantData } = await supabase
          .from('meeting_participants')
          .upsert(
            {
              meeting_id: meetingData.id,
              user_id: user.id,
              role: meetingData.host_id === user.id ? 'host' : 'participant',
              joined_at: new Date().toISOString(),
              is_video_enabled: true,
              is_muted: false,
              is_screen_sharing: false,
            },
            { onConflict: 'meeting_id,user_id' }
          )
          .select(`*, profile:profiles(*)`)
          .single();

        // Load all meeting participants
        const { data: allParticipants } = await supabase
          .from('meeting_participants')
          .select(`*, profile:profiles(*)`)
          .eq('meeting_id', meetingData.id)
          .is('left_at', null);

        if (isMounted && allParticipants) {
          setParticipants(allParticipants as MeetingParticipant[]);
        }

        // 2. Initialize WebRTC Manager
        const rtc = new WebRTCManager(
          meetingData.meeting_code,
          user.id,
          profile?.full_name || 'Participant',
          profile?.avatar_url || undefined,
          {
            onLocalStream: (stream) => {
              if (isMounted) setLocalStream(stream);
            },
            onRemoteStream: (peerId, stream) => {
              if (isMounted) {
                setRemoteStreams((prev) => {
                  const updated = new Map(prev);
                  updated.set(peerId, stream);
                  return updated;
                });
              }
            },
            onRemoteStreamRemoved: (peerId) => {
              if (isMounted) {
                setRemoteStreams((prev) => {
                  const updated = new Map(prev);
                  updated.delete(peerId);
                  return updated;
                });
                setPeerStates((prev) => {
                  const updated = new Map(prev);
                  updated.delete(peerId);
                  return updated;
                });
              }
            },
            onPeerMediaStateChanged: (peerId, state) => {
              if (isMounted) {
                setPeerStates((prev) => {
                  const updated = new Map(prev);
                  updated.set(peerId, state);
                  return updated;
                });
              }
            },
            onPeerConnectionStateChange: (peerId, state) => {
              if (isMounted) {
                setPeerConnections((prev) => {
                  const updated = new Map(prev);
                  updated.set(peerId, state);
                  return updated;
                });
              }
            },
            onError: (err) => {
              console.error('WebRTC Error:', err);
            },
          }
        );

        rtcManagerRef.current = rtc;

        // Initialize local camera and mic
        await rtc.initializeLocalMedia();

        // 3. Setup Supabase Realtime Channel for Signaling & Presence
        const channelName = `meeting-room:${meetingData.id}`;
        const roomChannel = supabase.channel(channelName, {
          config: {
            presence: { key: user.id },
            broadcast: { ack: true },
          },
        });

        // Set signaling channel on WebRTC Manager
        rtc.setSignalingChannel(roomChannel);

        // Track Supabase Presence
        roomChannel
          .on('presence', { event: 'sync' }, () => {
            const presenceState = roomChannel.presenceState();
            // Update online statuses
          })
          .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            info('Participant Joined', `${newPresences[0]?.userName || 'A teammate'} joined the space.`);
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            info('Participant Left', `${leftPresences[0]?.userName || 'A teammate'} left the space.`);
          })
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'meeting_participants',
              filter: `meeting_id=eq.${meetingData.id}`,
            },
            async () => {
              // Reload participants
              const { data: updatedMembers } = await supabase
                .from('meeting_participants')
                .select(`*, profile:profiles(*)`)
                .eq('meeting_id', meetingData.id)
                .is('left_at', null);

              if (isMounted && updatedMembers) {
                setParticipants(updatedMembers as MeetingParticipant[]);
              }
            }
          )
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await roomChannel.track({
                userId: user.id,
                userName: profile?.full_name,
                avatarUrl: profile?.avatar_url,
                joinedAt: new Date().toISOString(),
              });
              if (rtcManagerRef.current) {
                rtcManagerRef.current.broadcastJoin();
              }
            }
          });

        if (isMounted) setIsLoading(false);
      } catch (err: any) {
        console.error('Error joining meeting:', err);
        if (isMounted) {
          setJoinError(err.message || 'Could not connect to the meeting. Please check your network or try again.');
          setIsLoading(false);
        }
      }
    }

    initRoom();

    return () => {
      isMounted = false;
      if (rtcManagerRef.current) {
        rtcManagerRef.current.leaveMeeting();
      }
    };
  }, [meetingIdentifier, supabase, router, retryCount]);

  // Toolbar Callbacks
  const handleToggleAudio = () => {
    if (rtcManagerRef.current) {
      const newMuted = rtcManagerRef.current.toggleAudio();
      setIsMuted(newMuted);
    }
  };

  const handleToggleVideo = () => {
    if (rtcManagerRef.current) {
      const newVideo = rtcManagerRef.current.toggleVideo();
      setIsVideoEnabled(newVideo);
    }
  };

  const handleToggleScreenShare = async () => {
    if (!rtcManagerRef.current) return;

    if (isScreenSharing) {
      await rtcManagerRef.current.stopScreenShare();
      setIsScreenSharing(false);
    } else {
      const stream = await rtcManagerRef.current.startScreenShare();
      if (stream) {
        setIsScreenSharing(true);
      }
    }
  };

  const handleLeaveMeeting = async () => {
    if (rtcManagerRef.current) {
      rtcManagerRef.current.leaveMeeting();
    }

    if (currentUser && meeting) {
      // Mark left_at in meeting_participants
      await supabase
        .from('meeting_participants')
        .update({ left_at: new Date().toISOString() })
        .match({ meeting_id: meeting.id, user_id: currentUser.id });

      // Reset profile status to online
      await supabase.from('profiles').update({ status: 'online' }).eq('id', currentUser.id);
    }

    router.push('/dashboard');
  };

  const handleEndMeeting = async () => {
    if (!meeting || !currentUser || meeting.host_id !== currentUser.id) return;
    if (!confirm('Are you sure you want to end this meeting for everyone?')) return;

    await supabase
      .from('meetings')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', meeting.id);

    handleLeaveMeeting();
  };

  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/meetings/${meeting?.meeting_code || meetingIdentifier}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    success('Link Copied', 'Invitation URL copied to clipboard.');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleMuteParticipant = async (targetUserId: string) => {
    if (!meeting || meeting.host_id !== currentUser?.id) return;
    await supabase
      .from('meeting_participants')
      .update({ is_muted: true })
      .match({ meeting_id: meeting.id, user_id: targetUserId });
    success('Muted Participant', 'Participant microphone was muted.');
  };

  const handleRemoveParticipant = async (targetUserId: string) => {
    if (!meeting || meeting.host_id !== currentUser?.id) return;
    await supabase
      .from('meeting_participants')
      .update({ left_at: new Date().toISOString() })
      .match({ meeting_id: meeting.id, user_id: targetUserId });
    success('Removed Participant', 'Participant was removed from the meeting.');
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md animate-bounce mb-4">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Connecting to Space...</h3>
        <p className="text-xs text-slate-500 mt-1">Initializing audio, video mesh, and secure channels</p>
      </div>
    );
  }

  if (meetingNotFound) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Meeting Space Not Found</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-2 mb-6">
          The meeting code or link you provided does not exist or has expired.
        </p>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  if (meetingEnded) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mb-4">
          <PhoneOff className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">This Meeting Has Ended</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-2 mb-6">
          The host has concluded this session. Thank you for participating.
        </p>
        <Button onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Connection Error</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-2 mb-6">
          {joinError}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
          <Button
            onClick={() => {
              setJoinError(null);
              setIsLoading(true);
              setRetryCount((c) => c + 1);
            }}
          >
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  const isHost = meeting?.host_id === currentUser?.id;
  const remotePeersArray = Array.from(remoteStreams.entries());

  return (
    <div className="h-screen w-screen bg-slate-100/90 flex flex-col overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-14 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">
              {meeting?.title || 'ConnectSpace Room'}
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              {meeting?.meeting_code}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleCopyLink} className="text-xs h-8">
            {copiedLink ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            {copiedLink ? 'Copied' : 'Share Link'}
          </Button>
        </div>
      </header>

      {/* Main Viewport: Video Grid + Side Panels */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Calling Grid */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex items-center justify-center">
          <div
            className={cn(
              'w-full max-w-6xl h-full grid gap-4 items-center justify-center transition-all',
              remotePeersArray.length === 0 && 'grid-cols-1 max-w-3xl max-h-[75vh]',
              remotePeersArray.length === 1 && 'grid-cols-1 sm:grid-cols-2',
              remotePeersArray.length === 2 && 'grid-cols-1 sm:grid-cols-3',
              remotePeersArray.length >= 3 && 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3'
            )}
          >
            {/* Local Video Tile */}
            <VideoTile
              stream={localStream}
              participantName={currentUser?.full_name || 'You'}
              avatarUrl={currentUser?.avatar_url}
              isLocal={true}
              isMuted={isMuted}
              isVideoEnabled={isVideoEnabled}
              isScreenSharing={isScreenSharing}
              isHost={isHost}
            />

            {/* Remote Participants Video Tiles */}
            {remotePeersArray.map(([peerId, stream]) => {
              const state = peerStates.get(peerId);
              const connState = peerConnections.get(peerId);
              const participantObj = participants.find((p) => p.user_id === peerId);

              return (
                <VideoTile
                  key={peerId}
                  stream={stream}
                  participantName={state?.userName || participantObj?.profile?.full_name || 'Teammate'}
                  avatarUrl={state?.avatarUrl || participantObj?.profile?.avatar_url}
                  isLocal={false}
                  isMuted={state?.isMuted ?? false}
                  isVideoEnabled={state?.isVideoEnabled ?? true}
                  isScreenSharing={state?.isScreenSharing ?? false}
                  isHost={meeting?.host_id === peerId}
                  connectionState={connState}
                />
              );
            })}
          </div>
        </div>

        {/* Dynamic Side Panels */}
        {activePanel === 'chat' && meeting && currentUser && (
          <ChatPanel
            meetingId={meeting.id}
            currentUserId={currentUser.id}
            isHost={isHost}
            onClose={() => setActivePanel(null)}
          />
        )}

        {activePanel === 'participants' && currentUser && (
          <ParticipantsPanel
            participants={participants}
            currentUserId={currentUser.id}
            isHost={isHost}
            onClose={() => setActivePanel(null)}
            onMuteParticipant={handleMuteParticipant}
            onRemoveParticipant={handleRemoveParticipant}
          />
        )}

        {activePanel === 'files' && meeting && currentUser && (
          <FilePanel
            meetingId={meeting.id}
            currentUserId={currentUser.id}
            isHost={isHost}
            onClose={() => setActivePanel(null)}
          />
        )}

        {activePanel === 'whiteboard' && meeting && currentUser && (
          <WhiteboardPanel
            meetingId={meeting.id}
            currentUserId={currentUser.id}
            isHost={isHost}
            onClose={() => setActivePanel(null)}
          />
        )}
      </div>

      {/* Bottom Meeting Toolbar */}
      <MeetingToolbar
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={isScreenSharing}
        activePanel={activePanel}
        unreadMessagesCount={unreadMessages}
        participantsCount={participants.length}
        isHost={isHost}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onTogglePanel={(panel) => setActivePanel((prev) => (prev === panel ? null : panel))}
        onShowInfo={() => setInfoModalOpen(true)}
        onLeaveMeeting={handleLeaveMeeting}
        onEndMeeting={handleEndMeeting}
      />

      {/* Meeting Details Info Modal */}
      <Modal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        title="Meeting Details"
        description="Share meeting information with invitees."
      >
        <div className="space-y-4 pt-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{meeting?.title}</h4>
            {meeting?.description && (
              <p className="text-xs text-slate-500 mt-1">{meeting.description}</p>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Meeting Code:</span>
              <span className="font-mono font-semibold text-slate-900">{meeting?.meeting_code}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Host:</span>
              <span className="text-slate-900 font-semibold">{meeting?.host?.full_name || 'Host'}</span>
            </div>
          </div>

          <div className="pt-2">
            <Button size="md" className="w-full" onClick={handleCopyLink}>
              {copiedLink ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copiedLink ? 'Link Copied to Clipboard' : 'Copy Joining Link'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
