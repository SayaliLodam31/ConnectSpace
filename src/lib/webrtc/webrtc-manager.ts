/**
 * WebRTC Connection Manager for ConnectSpace
 * Implements Mesh Architecture with Perfect Negotiation Pattern
 * Supports Camera, Microphone, Screen Sharing, and Supabase Realtime Broadcast Signaling
 */

import { RealtimeChannel } from '@supabase/supabase-js';

export interface PeerMediaState {
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  userName?: string;
  avatarUrl?: string;
}

export interface WebRTCManagerCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onRemoteStreamRemoved?: (peerId: string) => void;
  onPeerMediaStateChanged?: (peerId: string, state: PeerMediaState) => void;
  onPeerConnectionStateChange?: (peerId: string, state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private peerStates: Map<string, PeerMediaState> = new Map();
  private makingOffer: Map<string, boolean> = new Map();
  private ignoreOffer: Map<string, boolean> = new Map();
  private iceCandidatesQueue: Map<string, RTCIceCandidateInit[]> = new Map();

  private meetingCode: string;
  private userId: string;
  private userName: string;
  private avatarUrl?: string;
  private channel: RealtimeChannel | null = null;
  private callbacks: WebRTCManagerCallbacks;

  public isMuted: boolean = false;
  public isVideoEnabled: boolean = true;
  public isScreenSharing: boolean = false;

  constructor(
    meetingCode: string,
    userId: string,
    userName: string,
    avatarUrl?: string,
    callbacks: WebRTCManagerCallbacks = {}
  ) {
    this.meetingCode = meetingCode;
    this.userId = userId;
    this.userName = userName;
    this.avatarUrl = avatarUrl;
    this.callbacks = callbacks;
  }

  /**
   * Set up local media (Camera and Microphone)
   */
  async initializeLocalMedia(options: { video?: boolean; audio?: boolean } = { video: true, audio: true }): Promise<MediaStream> {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        throw new Error('MediaDevices API not available in this environment');
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: options.video !== false ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: options.audio !== false ? { echoCancellation: true, noiseSuppression: true } : false,
      });

      this.isVideoEnabled = options.video !== false;
      this.isMuted = options.audio === false;

      // Apply initial track states
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = this.isVideoEnabled;
      });
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });

      if (this.callbacks.onLocalStream) {
        this.callbacks.onLocalStream(this.localStream);
      }

      return this.localStream;
    } catch (err: any) {
      console.warn('Could not initialize requested media, trying audio only fallback:', err);
      // Fallback: try audio only if video failed (e.g. no webcam available)
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.isVideoEnabled = false;
        if (this.callbacks.onLocalStream) {
          this.callbacks.onLocalStream(this.localStream);
        }
        return this.localStream;
      } catch (audioErr: any) {
        // Fallback: create empty media stream so app still runs
        console.warn('No camera or microphone available, proceeding with dummy stream:', audioErr);
        this.localStream = new MediaStream();
        this.isVideoEnabled = false;
        this.isMuted = true;
        if (this.callbacks.onLocalStream) {
          this.callbacks.onLocalStream(this.localStream);
        }
        return this.localStream;
      }
    }
  }

  /**
   * Connect to Supabase Realtime broadcast channel for signaling
   */
  setSignalingChannel(channel: RealtimeChannel) {
    this.channel = channel;

    // Listen to signaling events
    this.channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        this.handleSignalMessage(payload);
      })
      .on('broadcast', { event: 'media-state' }, ({ payload }) => {
        if (payload.userId !== this.userId) {
          this.peerStates.set(payload.userId, payload.state);
          if (this.callbacks.onPeerMediaStateChanged) {
            this.callbacks.onPeerMediaStateChanged(payload.userId, payload.state);
          }
        }
      });

    // Broadcast our join to announce our presence to existing peers
    this.broadcastJoin();
  }

  /**
   * Broadcast our join announcement to all peers in the room
   */
  public broadcastJoin() {
    this.sendSignal({
      type: 'user-joined',
      from: this.userId,
      userName: this.userName,
      avatarUrl: this.avatarUrl,
      state: {
        isMuted: this.isMuted,
        isVideoEnabled: this.isVideoEnabled,
        isScreenSharing: this.isScreenSharing,
      },
    });
  }

  /**
   * Broadcast signaling payload via Realtime Channel
   */
  private sendSignal(payload: any) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload,
      }).catch((err) => console.error('Signaling broadcast error:', err));
    }
  }

  /**
   * Handle incoming signaling messages
   */
  private async handleSignalMessage(payload: any) {
    if (!payload || payload.from === this.userId) return;

    // If message is addressed to a specific peer, verify it's for us
    if (payload.target && payload.target !== this.userId) return;

    const remoteUserId = payload.from;

    switch (payload.type) {
      case 'user-joined': {
        // A new peer joined. Initiate connection from our side.
        if (payload.state) {
          this.peerStates.set(remoteUserId, {
            ...payload.state,
            userName: payload.userName,
            avatarUrl: payload.avatarUrl,
          });
          if (this.callbacks.onPeerMediaStateChanged) {
            this.callbacks.onPeerMediaStateChanged(remoteUserId, this.peerStates.get(remoteUserId)!);
          }
        }
        // Respond with our identity and trigger connection
        this.sendSignal({
          type: 'user-welcome',
          target: remoteUserId,
          from: this.userId,
          userName: this.userName,
          avatarUrl: this.avatarUrl,
          state: {
            isMuted: this.isMuted,
            isVideoEnabled: this.isVideoEnabled,
            isScreenSharing: this.isScreenSharing,
          },
        });
        await this.getOrCreatePeerConnection(remoteUserId);
        break;
      }

      case 'user-welcome': {
        if (payload.state) {
          this.peerStates.set(remoteUserId, {
            ...payload.state,
            userName: payload.userName,
            avatarUrl: payload.avatarUrl,
          });
          if (this.callbacks.onPeerMediaStateChanged) {
            this.callbacks.onPeerMediaStateChanged(remoteUserId, this.peerStates.get(remoteUserId)!);
          }
        }
        await this.getOrCreatePeerConnection(remoteUserId);
        break;
      }

      case 'offer': {
        const pc = await this.getOrCreatePeerConnection(remoteUserId);
        const isPolite = this.userId > remoteUserId;
        const offerCollision = this.makingOffer.get(remoteUserId) || pc.signalingState !== 'stable';

        this.ignoreOffer.set(remoteUserId, !isPolite && offerCollision);
        if (this.ignoreOffer.get(remoteUserId)) {
          console.warn(`[WebRTC] Glare detected. Impolite peer ignoring offer from ${remoteUserId}`);
          return;
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          // Drain queued ICE candidates
          const queued = this.iceCandidatesQueue.get(remoteUserId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          this.iceCandidatesQueue.delete(remoteUserId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          this.sendSignal({
            type: 'answer',
            target: remoteUserId,
            from: this.userId,
            answer,
          });
        } catch (err: any) {
          console.error('[WebRTC] Error handling offer:', err);
        }
        break;
      }

      case 'answer': {
        const pc = this.peers.get(remoteUserId);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            const queued = this.iceCandidatesQueue.get(remoteUserId) || [];
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            this.iceCandidatesQueue.delete(remoteUserId);
          } catch (err: any) {
            console.error('[WebRTC] Error setting remote description from answer:', err);
          }
        }
        break;
      }

      case 'ice-candidate': {
        const pc = this.peers.get(remoteUserId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err: any) {
            console.error('[WebRTC] Error adding ICE candidate:', err);
          }
        } else {
          // Queue candidate until remote description is set
          const queue = this.iceCandidatesQueue.get(remoteUserId) || [];
          queue.push(payload.candidate);
          this.iceCandidatesQueue.set(remoteUserId, queue);
        }
        break;
      }

      case 'user-left': {
        this.closePeerConnection(remoteUserId);
        break;
      }
    }
  }

  /**
   * Create or retrieve an RTCPeerConnection for a remote peer
   */
  private async getOrCreatePeerConnection(remoteUserId: string): Promise<RTCPeerConnection> {
    if (this.peers.has(remoteUserId)) {
      return this.peers.get(remoteUserId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(remoteUserId, pc);
    this.makingOffer.set(remoteUserId, false);
    this.ignoreOffer.set(remoteUserId, false);

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE Candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          target: remoteUserId,
          from: this.userId,
          candidate,
        });
      }
    };

    // Handle incoming remote media tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      if (this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(remoteUserId, remoteStream);
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      if (this.callbacks.onPeerConnectionStateChange) {
        this.callbacks.onPeerConnectionStateChange(remoteUserId, pc.connectionState);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        // Attempt ICE restart if polite peer
        if (this.userId > remoteUserId && pc.restartIce) {
          pc.restartIce();
        }
      }
    };

    // Perfect Negotiation pattern onnegotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer.set(remoteUserId, true);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        this.sendSignal({
          type: 'offer',
          target: remoteUserId,
          from: this.userId,
          offer,
        });
      } catch (err: any) {
        console.error('[WebRTC] Negotiation error:', err);
      } finally {
        this.makingOffer.set(remoteUserId, false);
      }
    };

    return pc;
  }

  /**
   * Toggle Audio Mute
   */
  toggleAudio(forceState?: boolean): boolean {
    this.isMuted = forceState !== undefined ? forceState : !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    this.broadcastMediaState();
    return this.isMuted;
  }

  /**
   * Toggle Video On / Off
   */
  toggleVideo(forceState?: boolean): boolean {
    this.isVideoEnabled = forceState !== undefined ? forceState : !this.isVideoEnabled;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = this.isVideoEnabled;
      });
    }
    this.broadcastMediaState();
    return this.isVideoEnabled;
  }

  /**
   * Start Screen Sharing using getDisplayMedia
   */
  async startScreenShare(): Promise<MediaStream | null> {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing not supported on this device/browser');
      }

      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];
      if (!screenTrack) return null;

      this.isScreenSharing = true;

      // Replace video tracks on all peer connections with screen track
      for (const [_, pc] of this.peers.entries()) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, this.screenStream);
        }
      }

      // Handle user stopping screen share from browser banner
      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      this.broadcastMediaState();

      if (this.callbacks.onLocalStream && this.screenStream) {
        this.callbacks.onLocalStream(this.screenStream);
      }

      return this.screenStream;
    } catch (err: any) {
      console.warn('Screen share cancelled or failed:', err);
      this.isScreenSharing = false;
      this.broadcastMediaState();
      return null;
    }
  }

  /**
   * Stop Screen Sharing and restore camera track
   */
  async stopScreenShare() {
    if (!this.isScreenSharing) return;

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    this.isScreenSharing = false;

    // Restore camera video track on all peer connections
    const cameraVideoTrack = this.localStream?.getVideoTracks()[0] || null;
    for (const [_, pc] of this.peers.entries()) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === 'video' || (!s.track && cameraVideoTrack));
      if (videoSender && cameraVideoTrack) {
        await videoSender.replaceTrack(cameraVideoTrack);
      }
    }

    if (this.callbacks.onLocalStream && this.localStream) {
      this.callbacks.onLocalStream(this.localStream);
    }

    this.broadcastMediaState();
  }

  /**
   * Broadcast media state changes to all peers
   */
  private broadcastMediaState() {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'media-state',
        payload: {
          userId: this.userId,
          state: {
            isMuted: this.isMuted,
            isVideoEnabled: this.isVideoEnabled,
            isScreenSharing: this.isScreenSharing,
            userName: this.userName,
            avatarUrl: this.avatarUrl,
          },
        },
      }).catch((e) => console.error('Error broadcasting media state:', e));
    }
  }

  /**
   * Close a specific peer connection
   */
  private closePeerConnection(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    this.peerStates.delete(peerId);
    this.makingOffer.delete(peerId);
    this.ignoreOffer.delete(peerId);
    this.iceCandidatesQueue.delete(peerId);

    if (this.callbacks.onRemoteStreamRemoved) {
      this.callbacks.onRemoteStreamRemoved(peerId);
    }
  }

  /**
   * Clean up all peer connections and media tracks when leaving the meeting
   */
  leaveMeeting() {
    // Notify peers that we are leaving
    this.sendSignal({
      type: 'user-left',
      from: this.userId,
    });

    // Close all peer connections
    for (const [peerId, pc] of this.peers.entries()) {
      pc.close();
    }
    this.peers.clear();
    this.peerStates.clear();
    this.iceCandidatesQueue.clear();

    // Stop screen sharing tracks
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    // Stop all local camera/mic tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }

    this.isScreenSharing = false;
  }
}
