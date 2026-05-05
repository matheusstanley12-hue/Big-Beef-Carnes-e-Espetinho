import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://unmszmwvexpytoeqdpgv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubXN6bXd2ZXhweXRvZXFkcGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MzUxNTIsImV4cCI6MjA5MzUxMTE1Mn0.AiaJgnY1gvhLxv-bobm0lMTO4r_seYK19tLc1cctUmM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const tempAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}
