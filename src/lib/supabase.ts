/**
 * @fileoverview Supabase client initialisation for the Doraemon Kindergarten
 * Management System.
 *
 * Usage:
 * ```ts
 * import { supabase, getCurrentUser } from '@/src/lib/supabase';
 * ```
 *
 * Environment variables (set via `.env`):
 *  - `VITE_SUPABASE_URL`      – Project REST URL
 *  - `VITE_SUPABASE_ANON_KEY` – Public anon/service-role key
 */

import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// ─────────────────────────────────────────────
// Environment validation
// ─────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[supabase] Missing environment variables. ' +
      'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.',
  );
}

// ─────────────────────────────────────────────
// Typed Supabase client
// ─────────────────────────────────────────────

/**
 * Pre-configured, typed Supabase client.
 *
 * The generic parameter feeds the auto-generated `Database` type so that
 * `.from('students')` returns the correct row types automatically.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);

// ─────────────────────────────────────────────
// Auth helper functions
// ─────────────────────────────────────────────

/**
 * Return the currently authenticated Supabase `User`, or `null` if not signed
 * in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Return the active session, or `null`.
 */
export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Sign in with email + password.
 */
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Create a new account with email + password.
 * An entry in the `users` (profiles) table should be created separately or via
 * a database trigger on `auth.users`.
 */
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out the current user and clear the local session.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────

/**
 * Upload a file to a Supabase Storage bucket and return its public URL.
 *
 * @param bucket  - Storage bucket name (e.g. `avatars`, `documents`).
 * @param path    - Destination path inside the bucket.
 * @param file    - The `File` or `Blob` to upload.
 * @returns       The public URL of the uploaded file.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
): Promise<string> {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return publicUrl;
}

/**
 * Delete a file from a Supabase Storage bucket.
 *
 * @param bucket - Storage bucket name.
 * @param paths  - One or more file paths to delete.
 */
export async function deleteFile(bucket: string, paths: string[]) {
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// Realtime helpers
// ─────────────────────────────────────────────

/**
 * Subscribe to INSERT / UPDATE / DELETE events on a table.
 *
 * @param table    - Table name to listen on.
 * @param callback - Invoked with the realtime payload whenever a change occurs.
 * @returns A channel reference – call `.unsubscribe()` to stop listening.
 *
 * @example
 * ```ts
 * const channel = subscribeToTable('notifications', (payload) => {
 *   console.log('New notification:', payload.new);
 * });
 * // later…
 * channel.unsubscribe();
 * ```
 */
export function subscribeToTable(
  table: keyof Database['public']['Tables'],
  callback: (payload: Record<string, unknown>) => void,
) {
  return supabase
    .channel(`public:${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: table as string },
      (payload) => callback(payload as unknown as Record<string, unknown>),
    )
    .subscribe();
}

export default supabase;
