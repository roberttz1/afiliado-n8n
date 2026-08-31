import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase URL ou Anon Key não configuradas. ' +
    'O dashboard vai rodar em modo demo com dados fictícios.'
  );
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Client com service role para operações server-side (API Routes)
export function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn('⚠️ Service key não configurada.');
    return null;
  }
  return createClient(supabaseUrl, serviceKey);
}
