import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwkzbkabvisqbelocdff.supabase.co';
const supabaseAnonKey = 'sb_publishable_3dzUU2hGNdPLm1hQHeKJgg_gGGvvjf0';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('Testando...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'alairmoura@resenhamoura.com',
    password: '749812Ab@'
  });
  if (error) {
    console.error('Erro no login:', error.message);
    return;
  }
  console.log('Sucesso no login! User ID:', data.user.id);

  // Tentando buscar o perfil como faria o front-end!
  const { data: profileArgs, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileErr) {
    console.error('Erro ao buscar o perfil:', profileErr);
  } else {
    console.log('Perfil encontrado com sucesso:', profileArgs);
  }
}
main();
