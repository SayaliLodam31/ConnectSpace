import { createBrowserClient } from '@supabase/ssr';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    key &&
    url.trim() !== '' &&
    key.trim() !== '' &&
    !url.includes('placeholder.supabase.co') &&
    url.startsWith('http')
  );
}

export function getCleanSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const cleanKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
  return {
    supabaseUrl: cleanUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey: cleanKey || 'placeholder-anon-key',
    isConfigured: isSupabaseConfigured(),
  };
}

export function createClient() {
  const { supabaseUrl, supabaseAnonKey, isConfigured } = getCleanSupabaseConfig();

  if (!isConfigured) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[ConnectSpace] Supabase credentials are missing or unconfigured. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
      );
    }
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Global browser client singleton for client components
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}
