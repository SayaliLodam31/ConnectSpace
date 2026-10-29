'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, X, MessageSquare, Loader2 } from 'lucide-react';
import { MeetingMessage, Profile } from '@/types/database';
import { Avatar } from '@/components/ui/avatar';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { sanitizeHtml } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

interface ChatPanelProps {
  meetingId: string;
  currentUserId: string;
  isHost: boolean;
  onClose: () => void;
}

export function ChatPanel({ meetingId, currentUserId, isHost, onClose }: ChatPanelProps) {
  const supabase = getSupabaseBrowserClient();
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load existing messages
  useEffect(() => {
    async function loadMessages() {
      const { data, error } = await supabase
        .from('meeting_messages')
        .select(`
          *,
          sender:profiles(*)
        `)
        .eq('meeting_id', meetingId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data as MeetingMessage[]);
        setTimeout(scrollToBottom, 100);
      }
    }

    loadMessages();

    // Subscribe to new and updated messages via Supabase Realtime
    const channel = supabase
      .channel(`chat:${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_messages',
          filter: `meeting_id=eq.${meetingId}`,
        },
        async (payload) => {
          // Fetch sender profile details
          const { data: senderData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.sender_id)
            .single();

          const newMsg: MeetingMessage = {
            ...(payload.new as MeetingMessage),
            sender: senderData as Profile,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(scrollToBottom, 50);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meeting_messages',
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => {
          if (payload.new.deleted_at) {
            setMessages((prev) => prev.filter((m) => m.id !== payload.new.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, supabase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputText('');

    try {
      const { error } = await supabase.from('meeting_messages').insert({
        meeting_id: meetingId,
        sender_id: currentUserId,
        message: text,
        message_type: 'text',
      });

      if (error) {
        console.error('Failed to send message:', error);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    await supabase
      .from('meeting_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  return (
    <div className="w-80 sm:w-96 bg-white border-l border-slate-200/80 flex flex-col h-full shadow-card z-20">
      {/* Header */}
      <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-slate-900">Meeting Chat</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Send a message to start the team conversation."
            className="border-none py-12"
          />
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            const canDelete = isMe || isHost;
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 group ${isMe ? 'flex-row-reverse' : ''}`}
              >
                <Avatar
                  src={msg.sender?.avatar_url}
                  name={msg.sender?.full_name || 'User'}
                  size="xs"
                  className="mt-1"
                />

                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[11px] font-semibold text-slate-700">
                      {isMe ? 'You' : msg.sender?.full_name || 'Teammate'}
                    </span>
                    <span className="text-[10px] text-slate-400">{timeStr}</span>
                  </div>

                  <div
                    className={`relative p-3 rounded-2xl text-xs leading-relaxed break-words shadow-subtle ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                    }`}
                  >
                    {msg.message}

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Delete message"
                        className="absolute -top-2 -right-2 p-1 bg-white text-slate-400 hover:text-red-600 rounded-full shadow border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-subtle focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
          <input
            type="text"
            placeholder="Type a message to everyone..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 text-xs text-slate-900 bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            aria-label={isSending ? 'Sending message...' : 'Send message'}
            className="p-1.5 text-blue-600 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
