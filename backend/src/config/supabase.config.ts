import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

type Database = Record<string, unknown>;
let supabaseClient: SupabaseClient<Database>;

export const initializeSupabase = (
  configService: ConfigService,
): SupabaseClient<Database> => {
  if (!supabaseClient) {
    const supabaseUrl = configService.get<string>('SUPABASE_URL');
    const supabaseKey = configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Service Key must be provided');
    }

    supabaseClient = createClient<Database>(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
};

export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized');
  }
  return supabaseClient;
};
