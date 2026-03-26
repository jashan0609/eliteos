import { createClient } from "@supabase/supabase-js";

// Server-side only — uses Service Role Key to bypass RLS.
// NEVER import this file from client components.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
