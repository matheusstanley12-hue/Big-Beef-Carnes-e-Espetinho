import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bwkzbkabvisqbelocdff.supabase.co';
const supabaseAnonKey = 'sb_publishable_3dzUU2hGNdPLm1hQHeKJgg_gGGvvjf0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function forceFix() {
  console.log('--- FORCING FIX FOR MESAS 11 AND 15 ---');
  
  // 1. Get IDs to be absolutely sure
  const { data: fetchMesas, error: fetchError } = await supabase
    .from('mesas')
    .select('id, numero, status')
    .in('numero', [11, 15]);

  if (fetchError) {
    console.error('Error fetching mesas:', fetchError);
    return;
  }

  console.log('Found mesas:', fetchMesas);

  if (!fetchMesas || fetchMesas.length === 0) {
    console.log('Mesas not found by number. Trying string matching...');
    const { data: fetchMesasStr } = await supabase
      .from('mesas')
      .select('id, numero, status')
      .in('numero', ['11', '15']);
    console.log('Found mesas (string):', fetchMesasStr);
  }

  const ids = fetchMesas.map(m => m.id);
  
  if (ids.length > 0) {
    console.log('Updating status for IDs:', ids);
    const { data: updateData, error: updateError } = await supabase
      .from('mesas')
      .update({ status: 'ocupada', precisa_garcom: false })
      .in('id', ids);

    if (updateError) {
      console.error('Error during update:', updateError);
    } else {
      console.log('SUCCESS: Mesas updated. Verifying...');
      const { data: verifyData } = await supabase.from('mesas').select('id, numero, status').in('id', ids);
      console.log('VERIFICATION:', verifyData);
    }
  } else {
    console.log('No IDs found to update.');
  }
}

forceFix();
