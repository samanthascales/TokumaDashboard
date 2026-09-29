import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import { IS_EMBEDDED } from '../env';

/**
 * Cloud accounts + storage (Supabase). Enabled when the build has
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. The anon key is meant to be
 * public — access is enforced by Row Level Security in the database
 * (see supabase/migrations/001_workspaces.sql).
 *
 * Without those settings (or in the embedded claude.ai copy, which can't reach
 * other hosts) the app runs in local mode: data stays in this browser only.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  !IS_EMBEDDED && url && anonKey
    ? createClient(url, anonKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

export const CLOUD_ENABLED = supabase !== null;

export type { Session, User };

export interface WorkspaceRow {
  id: string;
  owner_id: string;
  data: Record<string, unknown>;
  business_name: string;
  allow_support: boolean;
  updated_at: string;
}

export interface SupportLogEntry {
  id: number;
  reason: string;
  accessed_at: string;
}

export interface AdminWorkspace {
  id: string;
  business_name: string;
  owner_email: string;
  allow_support: boolean;
  products: number;
  transactions: number;
  created_at: string;
  updated_at: string;
}

function db() {
  if (!supabase) throw new Error('Cloud storage is not configured');
  return supabase;
}

/** Where auth emails (confirm, reset) send people back to: this app's own address. */
export const appUrl = () => `${window.location.origin}${window.location.pathname}`;

export async function signUp(email: string, password: string) {
  const { data, error } = await db().auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await db().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email: string) {
  const { error } = await db().auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await db().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  await db().auth.signOut();
}

/** Loads the signed-in user's workspace, creating an empty one on first sign-in. */
export async function loadWorkspace(userId: string): Promise<WorkspaceRow> {
  const found = await db().from('workspaces').select('*').eq('owner_id', userId).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return found.data as WorkspaceRow;
  const created = await db().from('workspaces').insert({ owner_id: userId }).select('*').single();
  if (created.error) {
    // Another tab may have created it at the same moment.
    const again = await db().from('workspaces').select('*').eq('owner_id', userId).single();
    if (again.error) throw created.error;
    return again.data as WorkspaceRow;
  }
  return created.data as WorkspaceRow;
}

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; conflict: WorkspaceRow };

/**
 * Saves only if nobody else (another tab or device) saved since `lastSeen`.
 * On a conflict, returns the newer row so the caller can switch to it.
 */
export async function saveWorkspace(id: string, data: unknown, businessName: string, lastSeen: string): Promise<SaveResult> {
  const res = await db()
    .from('workspaces')
    .update({ data, business_name: businessName })
    .eq('id', id)
    .eq('updated_at', lastSeen)
    .select('updated_at');
  if (res.error) throw res.error;
  if (res.data && res.data.length === 1) return { ok: true, updatedAt: (res.data[0] as { updated_at: string }).updated_at };
  const latest = await db().from('workspaces').select('*').eq('id', id).single();
  if (latest.error) throw latest.error;
  return { ok: false, conflict: latest.data as WorkspaceRow };
}

export async function setSupportAccess(id: string, allow: boolean) {
  const { data, error } = await db().from('workspaces').update({ allow_support: allow }).eq('id', id).select('updated_at, allow_support').single();
  if (error) throw error;
  return data as { updated_at: string; allow_support: boolean };
}

export async function loadSupportLog(workspaceId: string): Promise<SupportLogEntry[]> {
  const { data, error } = await db()
    .from('support_access_log')
    .select('id, reason, accessed_at')
    .eq('workspace_id', workspaceId)
    .order('accessed_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as SupportLogEntry[];
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await db().rpc('is_admin');
  if (error) return false;
  return data === true;
}

export async function adminListWorkspaces(): Promise<AdminWorkspace[]> {
  const { data, error } = await db().rpc('admin_list_workspaces');
  if (error) throw error;
  return data as AdminWorkspace[];
}

export async function adminOpenWorkspace(target: string, reason: string): Promise<Record<string, unknown>> {
  const { data, error } = await db().rpc('admin_open_workspace', { target, reason });
  if (error) throw error;
  return data as Record<string, unknown>;
}

/** Turns Supabase/network errors into a sentence a person can act on. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/Invalid login credentials/i.test(msg)) return 'That email and password don’t match an account.';
  if (/Email not confirmed/i.test(msg)) return 'Confirm your email first — check your inbox for the link we sent.';
  if (/User already registered/i.test(msg)) return 'An account with that email already exists. Sign in instead.';
  if (/Password should be at least/i.test(msg)) return 'Use a password of at least 8 characters.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Wait a few minutes and try again.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Can’t reach Tokuma’s servers. Check your internet connection and try again.';
  if (/not allowed support access/i.test(msg)) return 'This business hasn’t allowed support access.';
  if (/not authorized/i.test(msg)) return 'Your account doesn’t have admin access.';
  return msg;
}
