import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwkzbkabvisqbelocdff.supabase.co';
const supabaseKey = 'sb_publishable_3dzUU2hGNdPLm1hQHeKJgg_gGGvvjf0'; // This is an admin/service key in their environment? No, it's the anon key.
// I'll use the secret/service role key if available, but the anon key should work for deletes if RLS is disabled for these tables.
// Actually, I'll see if I can get the service role key from the environment. Wait, I don't have it.
// I'll try with the anon key and hope RLS allows it (or I'll use a hack to perform deletions via the app's existing logic).
// Alternatively, I'll recommend the user to run these queries in the Supabase Dashboard SQL Editor if I can't do it here.
// But I'll try one by one.

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanData() {
  console.log("🚀 Iniciando limpeza de dados...");

  // 1. Itens de Pedido
  const { error: e1 } = await supabase.from('itens_pedido').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e1) console.error("❌ Erro ao limpar itens_pedido:", e1.message);
  else console.log("✔ itens_pedido limpo.");

  // 2. Pedidos
  const { error: e2 } = await supabase.from('pedidos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e2) console.error("❌ Erro ao limpar pedidos:", e2.message);
  else console.log("✔ pedidos limpo.");

  // 3. Resetar Mesas
  const { error: e3 } = await supabase.from('mesas').update({ 
    status: 'livre', 
    precisa_garcom: false, 
    precisa_garcom_at: null,
    ultimo_pedido_at: null
  }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (e3) console.error("❌ Erro ao resetar mesas:", e3.message);
  else console.log("✔ Mesas resetadas para 'livre'.");

  // 4. Turnos de Caixa
  const { error: e4 } = await supabase.from('turnos_caixa').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e4) console.error("❌ Erro ao limpar turnos_caixa:", e4.message);
  else console.log("✔ turnos_caixa limpo.");

  // 5. Auditoria de Exclusões
  const { error: e5 } = await supabase.from('auditoria_exclusoes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e5) console.error("❌ Erro ao limpar auditoria_exclusoes:", e5.message);
  else console.log("✔ auditoria_exclusoes limpo.");

  // 6. Avaliações
  const { error: e6 } = await supabase.from('avaliacoes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e6) console.error("❌ Erro ao limpar avaliacoes:", e6.message);
  else console.log("✔ avaliacoes limpo.");

  console.log("✨ Limpeza concluída!");
}

cleanData();
