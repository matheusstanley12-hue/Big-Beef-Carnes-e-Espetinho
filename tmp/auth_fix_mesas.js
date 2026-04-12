import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwkzbkabvisqbelocdff.supabase.co';
const supabaseAnonKey = 'sb_publishable_3dzUU2hGNdPLm1hQHeKJgg_gGGvvjf0';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

async function loginAndFix() {
  console.log('--- LOGGING IN AS ADMIN TO FIX MESAS ---');
  
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'alair@gmail.com',
    password: 'Mima0904*'
  });

  if (loginError) {
    console.error('Login Error:', loginError);
    return;
  }

  console.log('Login successful as:', loginData.user?.email);

  // Use the session to update
  const { data: updateData, error: updateError } = await supabase
    .from('mesas')
    .update({ status: 'ocupada', precisa_garcom: false })
    .in('numero', [11, 15]);

  if (updateError) {
    console.error('Update Error:', updateError);
  } else {
    console.log('Update Successful. Verifying...');
    const { data: verifyData } = await supabase
      .from('mesas')
      .select('numero, status')
      .in('numero', [11, 15]);
    console.log('VERIFICATION:', verifyData);
  }
}

loginAndFix();
