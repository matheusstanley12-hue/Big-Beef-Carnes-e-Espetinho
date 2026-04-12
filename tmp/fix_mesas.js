import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwkzbkabvisqbelocdff.supabase.co';
const supabaseAnonKey = 'sb_publishable_3dzUU2hGNdPLm1hQHeKJgg_gGGvvjf0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixMesas() {
  console.log('Iniciando correção das mesas 11 e 15...');
  
  const { data, error } = await supabase
    .from('mesas')
    .update({ status: 'ocupada', precisa_garcom: false })
    .in('numero', [11, 15]);

  if (error) {
    console.error('Erro ao atualizar mesas:', error);
  } else {
    console.log('Mesas 11 e 15 voltaram para o status OCUPADA com sucesso.');
  }

  // Verificar se há itens marcados como 'aguardando conta' ou algo assim
  // No seu sistema, parece que o status da mesa controla a visibilidade no caixa.
}

fixMesas();
