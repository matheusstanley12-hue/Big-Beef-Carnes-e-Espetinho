import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Realtime reativado para suportar atualizações de estoque instantâneas.
const clientOptions = {
  realtime: {},
  global: {
    headers: { 'x-client-info': 'big-beef' },
  },
};

export const supabase = createClient(supabaseUrl || 'https://llbxgjybevpcxvdbgvew.supabase.co', supabaseAnonKey || 'sb_publishable_YfDyphgJwowet_GgLjaPxA_ohsV-ZD-', clientOptions);

export const tempAuthClient = createClient(supabaseUrl || 'https://llbxgjybevpcxvdbgvew.supabase.co', supabaseAnonKey || 'sb_publishable_YfDyphgJwowet_GgLjaPxA_ohsV-ZD-', {
  auth: { persistSession: false },
  ...clientOptions,
});

// Access from console for maintenance/registration
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}
