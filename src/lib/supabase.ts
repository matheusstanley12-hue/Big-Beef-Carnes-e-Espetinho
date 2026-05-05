import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://llbxgjybevpcxvdbgvew.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsYnhnanliZXZwY3h2ZGJndmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDEyMzgsImV4cCI6MjA5MTU3NzIzOH0.JMGZaCfRwcYxVa6tGS53AbNnjH0vV4_KUCkpHchIbFY';

// Realtime reativado para suportar atualizações de estoque instantâneas.
const clientOptions = {
  realtime: {},
  global: {
    headers: { 'x-client-info': 'big-beef' },
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions);

export const tempAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  ...clientOptions,
});

// Access from console for maintenance/registration
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}
