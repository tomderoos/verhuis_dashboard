import { createClient } from '@supabase/supabase-js';

// Publieke waarden — veilig om in de client te staan.
// Toegang wordt afgeschermd door RLS-policies in Supabase (auth verplicht).
const SUPABASE_URL = 'https://zwviqwoxhqsmdqvvbrgn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fy-NjLGXFNL6JMebaLbgUg_-ZUOJGqW';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
