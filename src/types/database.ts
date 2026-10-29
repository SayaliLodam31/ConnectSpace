export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MeetingStatus = 'scheduled' | 'active' | 'ended';
export type ParticipantRole = 'host' | 'cohost' | 'participant';
export type InvitationStatus = 'pending' | 'accepted' | 'declined';
export type MessageType = 'text' | 'system' | 'file';
export type WhiteboardItemType = 'stroke' | 'text' | 'shape' | 'image' | 'eraser';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  job_title: string | null;
  timezone: string | null;
  status: 'online' | 'offline' | 'busy' | 'in_meeting';
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  meeting_code: string;
  status: MeetingStatus;
  scheduled_start: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  host?: Profile;
  participants?: MeetingParticipant[];
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  role: ParticipantRole;
  joined_at: string;
  left_at: string | null;
  is_muted: boolean;
  is_video_enabled: boolean;
  is_screen_sharing: boolean;
  profile?: Profile;
}

export interface MeetingInvitation {
  id: string;
  meeting_id: string;
  inviter_id: string;
  invitee_email: string;
  invitee_id: string | null;
  status: InvitationStatus;
  created_at: string;
}

export interface MeetingMessage {
  id: string;
  meeting_id: string;
  sender_id: string;
  message: string;
  message_type: MessageType;
  created_at: string;
  deleted_at: string | null;
  sender?: Profile;
}

export interface MeetingFile {
  id: string;
  meeting_id: string;
  uploaded_by: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
  uploader?: Profile;
  signedUrl?: string;
}

export interface Whiteboard {
  id: string;
  meeting_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface WhiteboardItem {
  id: string;
  whiteboard_id: string;
  created_by: string;
  item_type: WhiteboardItemType;
  data: {
    points?: { x: number; y: number }[];
    color?: string;
    width?: number;
    text?: string;
    x?: number;
    y?: number;
    shapeType?: 'rectangle' | 'circle' | 'line';
    widthPx?: number;
    heightPx?: number;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
