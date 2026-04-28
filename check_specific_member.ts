import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xmidlniynlujtmduwqgf.supabase.co',
  'sb_secret_EAwZ_yUtBNJpvQCOU-4Taw_-0umtcep'
);

async function check() {
  const userId = 'c32fcc27-eae3-4318-986e-89a24b0bdbfa';
  
  console.log('Checking member for user_id:', userId);
  
  const { data: member, error } = await supabase
    .from('members')
    .select('*, barbershops(*)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  console.log('Result:', { member: !!member, error });
  if (member) {
    console.log('Member data:', JSON.stringify(member, null, 2));
  }
}

check().catch(console.error);
