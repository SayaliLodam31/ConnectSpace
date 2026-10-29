'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Bell, Shield, ShieldCheck, Key, Save, CheckCircle2, AlertCircle, Cookie } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';
import { useToast } from '@/components/ui/toast';
import { openCookieSettings } from '@/components/ui/cookie-banner';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'privacy'>('profile');
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Profile Form Fields
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [timezone, setTimezone] = useState('UTC');

  // Security Form Fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          setCurrentUser(profile);
          setFullName(profile.full_name || '');
          setAvatarUrl(profile.avatar_url || '');
          setJobTitle(profile.job_title || '');
          setTimezone(profile.timezone || 'UTC');
        }
      } catch (err) {
        console.error('Error fetching profile settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [supabase, router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          avatar_url: avatarUrl.trim() || null,
          job_title: jobTitle.trim() || null,
          timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              full_name: fullName.trim(),
              avatar_url: avatarUrl.trim() || null,
              job_title: jobTitle.trim() || null,
              timezone,
            }
          : null
      );

      success('Profile Updated', 'Your changes have been saved.');
    } catch (err: any) {
      toastError('Update Failed', err.message || 'Could not save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toastError('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('Mismatch', 'Passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      success('Password Changed', 'Your login credentials have been updated.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toastError('Error', err.message || 'Could not update password.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell userProfile={currentUser}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Account Settings</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage your personal profile, workspace identity, security, and notification preferences
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" /> Profile Info
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" /> Security & Password
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'privacy'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cookie className="w-4 h-4" /> Privacy & Cookies
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Avatar Preview */}
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <Avatar
                  src={avatarUrl || currentUser?.avatar_url}
                  name={fullName || currentUser?.full_name || 'User'}
                  size="xl"
                />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {fullName || currentUser?.full_name || 'Your Profile Picture'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Provide an avatar image URL or use automatically generated initials
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />

                <Input
                  label="Job Title"
                  placeholder="Staff Product Designer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>

              <Input
                label="Avatar Image URL (Optional)"
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-subtle"
                >
                  <option value="UTC">UTC (Universal Time)</option>
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                  <option value="America/Chicago">Central Time (US & Canada)</option>
                  <option value="America/Denver">Mountain Time (US & Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Central European Time (Paris, Berlin)</option>
                  <option value="Asia/Kolkata">India Standard Time (IST)</option>
                  <option value="Asia/Tokyo">Tokyo, Japan (JST)</option>
                </select>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button type="submit" isLoading={isSaving} className="shadow-md shadow-blue-600/20">
                  <Save className="w-4 h-4 mr-1.5" />
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card">
            <div className="mb-6">
              <h3 className="text-base font-bold text-slate-900">Change Password</h3>
              <p className="text-xs text-slate-500 mt-1">
                Ensure your account is using a long, random password to stay secure.
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
              <Input
                label="New Password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />

              <div className="pt-2">
                <Button type="submit" isLoading={isSaving} className="shadow-md shadow-blue-600/20">
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Privacy & Cookies Tab */}
        {activeTab === 'privacy' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Privacy, Cookies &amp; Data Security</h3>
              <p className="text-xs text-slate-500 mt-1">
                Review how your data is handled and adjust your cookie consent preferences.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Row Level Security (RLS) &amp; Encryption</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  ConnectSpace enforces PostgreSQL Row Level Security on all meetings, messages, files, and whiteboards. Video and audio media are transmitted directly via peer-to-peer WebRTC encrypted streams.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200/80 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">Cookie Consent Preferences</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Configure essential and optional device storage preferences
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openCookieSettings}
                    className="shadow-subtle"
                  >
                    <Cookie className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                    Manage Cookies
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
