import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwkzbkabvisqbelocdff.supabase.co';
const supabaseAnonKey = 'sb_publishable_3dzUU2hGNdPLm1hQHeKJgg_gGGvvjf0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log('Tentando login com alairmoura@resenhamoura.com');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'alairmoura@resenhamoura.com',
    password: '749812Ab@'
  });

  if (error) {
    console.error('Erro no login:', error.message);
    return;
  }
  
  console.log('Login bem-sucedido. Buscando perfil...');
  const userId = data.user.id;
  
  const { data: profileData, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (profileErr) {
    console.error('Erro na profiles:', profileErr.message, profileErr.details, profileErr.hint);
  } else {
    console.log('Perfil retornado com sucesso:', profileData);
  }
}

testLogin();
