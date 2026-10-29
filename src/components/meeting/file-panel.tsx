'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  UploadCloud,
  FileText,
  Download,
  Trash2,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { MeetingFile } from '@/types/database';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatFileSize } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';

interface FilePanelProps {
  meetingId: string;
  currentUserId: string;
  isHost: boolean;
  onClose: () => void;
}

export function FilePanel({ meetingId, currentUserId, isHost, onClose }: FilePanelProps) {
  const supabase = getSupabaseBrowserClient();
  const { success, error: toastError } = useToast();
  const [files, setFiles] = useState<MeetingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load meeting files
  useEffect(() => {
    async function loadFiles() {
      const { data, error } = await supabase
        .from('meeting_files')
        .select(`
          *,
          uploader:profiles(*)
        `)
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setFiles(data as MeetingFile[]);
      }
    }

    loadFiles();

    // Subscribe to new and deleted files via Supabase Realtime
    const channel = supabase
      .channel(`files:${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_files',
          filter: `meeting_id=eq.${meetingId}`,
        },
        async (payload) => {
          const { data: uploaderData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.uploaded_by)
            .single();

          const newFile: MeetingFile = {
            ...(payload.new as MeetingFile),
            uploader: uploaderData || undefined,
          };

          setFiles((prev) => [newFile, ...prev.filter((f) => f.id !== newFile.id)]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'meeting_files',
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => {
          setFiles((prev) => prev.filter((f) => f.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, supabase]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toastError('File too large', 'Maximum permitted file size is 50MB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const fileExt = file.name.split('.').pop();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${meetingId}/${Date.now()}_${sanitizedName}`;

      // Upload file to Supabase private storage bucket
      const { data: uploadData, error: storageError } = await supabase.storage
        .from('meeting-files')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (storageError) throw storageError;

      setUploadProgress(80);

      // Save file metadata in meeting_files table
      const { error: dbError } = await supabase.from('meeting_files').insert({
        meeting_id: meetingId,
        uploaded_by: currentUserId,
        file_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
      });

      if (dbError) throw dbError;

      success('File Uploaded', `${file.name} is now available to participants.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toastError('Upload failed', err.message || 'Could not upload file.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDownload = async (file: MeetingFile) => {
    try {
      // Create a signed URL valid for 60 seconds
      const { data, error } = await supabase.storage
        .from('meeting-files')
        .createSignedUrl(file.storage_path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toastError('Download failed', err.message || 'Could not retrieve signed URL.');
    }
  };

  const handleDeleteFile = async (file: MeetingFile) => {
    try {
      // Remove from storage
      await supabase.storage.from('meeting-files').remove([file.storage_path]);

      // Remove record from meeting_files
      const { error } = await supabase.from('meeting_files').delete().eq('id', file.id);
      if (error) throw error;

      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      success('File Deleted', 'The file has been permanently removed.');
    } catch (err: any) {
      toastError('Delete failed', err.message || 'Could not delete file.');
    }
  };

  return (
    <div className="w-80 sm:w-96 bg-white border-l border-slate-200/80 flex flex-col h-full shadow-card z-20">
      {/* Header */}
      <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-slate-900">Meeting Files</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Upload Dropzone / Button */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="hidden"
          id="file-upload-input"
        />
        <label
          htmlFor="file-upload-input"
          className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 hover:border-blue-400 bg-white rounded-xl cursor-pointer transition-colors shadow-subtle group"
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-blue-600">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs font-semibold">Uploading...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-slate-600 group-hover:text-blue-600">
              <UploadCloud className="w-6 h-6" />
              <span className="text-xs font-semibold">Share a file with the team</span>
              <span className="text-[10px] text-slate-400">PDF, docs, sheets, images up to 50MB</span>
            </div>
          )}
        </label>
      </div>

      {/* Files List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
        {files.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No files shared"
            description="Upload documents or assets to share them securely with participants."
            className="border-none py-10"
          />
        ) : (
          files.map((file) => {
            const isUploader = file.uploaded_by === currentUserId;
            const canDelete = isUploader || isHost;

            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition-colors shadow-subtle group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate" title={file.file_name}>
                      {file.file_name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>•</span>
                      <span>{file.uploader?.full_name || 'Participant'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => handleDownload(file)}
                    title="Download file"
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {canDelete && (
                    <button
                      onClick={() => handleDeleteFile(file)}
                      title="Delete file"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
