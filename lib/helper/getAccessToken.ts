import { supabase } from "../supabaseClient";

export async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('NOT_AUTHENTICATED');
  return session.access_token;
}
