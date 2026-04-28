import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xmidlniynlujtmduwqgf.supabase.co',
  'sb_secret_EAwZ_yUtBNJpvQCOU-4Taw_-0umtcep'
);

async function check() {
  // Check members
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('=== RECENT MEMBERS ===');
  if (membersError) {
    console.error('Error:', membersError);
  } else {
    console.log(JSON.stringify(members, null, 2));
  }

  // Check barbershops  
  const { data: shops, error: shopsError } = await supabase
    .from('barbershops')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('\n=== RECENT BARBERSHOPS ===');
  if (shopsError) {
    console.error('Error:', shopsError);
  } else {
    console.log(JSON.stringify(shops, null, 2));
  }
}

check().catch(console.error);
