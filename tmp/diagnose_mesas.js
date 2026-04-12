import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwkzbkabvisqbelocdff.supabase.co';
const supabaseAnonKey = 'sb_publishable_3dzUU2hGNdPLm1hQHeKJgg_gGGvvjf0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnose() {
  console.log('--- DIAGNOSTIC START ---');
  
  const { data: mesasData } = await supabase.from('mesas').select('*').in('numero', [11, 15]);
  console.log('MESAS (11, 15):', JSON.stringify(mesasData, null, 2));

  if (mesasData && mesasData.length > 0) {
    const ids = mesasData.map(m => m.id);
    const { data: pedidosData } = await supabase.from('pedidos').select('*').in('mesa_id', ids).neq('status', 'finalizado');
    console.log('ACTIVE PEDIDOS FOR THESE MESAS:', JSON.stringify(pedidosData, null, 2));
  }
  
  console.log('--- DIAGNOSTIC END ---');
}

diagnose();
