import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { db as memoryDb } from './memoryStore';

export let supabase: SupabaseClient | null = null;

if (config.supabase.isConfigured) {
  try {
    supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('[DATA STORE] Initialized Supabase PostgreSQL Client in Cloud Mode');
  } catch (err) {
    console.warn('[DATA STORE] Failed to connect to Supabase, falling back to local memory store', err);
    supabase = null;
  }
} else {
  console.log('[DATA STORE] Operating in Local Development Mode (In-Memory Database with SAVISKAR 2026 Seed Data)');
}

export const getStore = () => memoryDb;
