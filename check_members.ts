import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xmidlniynlujtmduwqgf.supabase.co',
  'sb_secret_EAwZ_yUtBNJpvQCOU-4Taw_-0umtcep'
);

async function check() {
  const { data: members, error } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('Recent members:');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(JSON.stringify(members, null, 2));
  }
}

check().catch(console.error);
