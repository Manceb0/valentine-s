/**
 * Cliente Supabase. Configura con tu SUPABASE_URL y SUPABASE_ANON_KEY.
 * En producción usa variables de entorno (ej. Vercel) o sustituye aquí.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  typeof window !== "undefined" && window.__SUPABASE_URL__
    ? window.__SUPABASE_URL__
    : "https://ndlhbzyyueirtdagjuqw.supabase.co";
const SUPABASE_ANON_KEY =
  typeof window !== "undefined" && window.__SUPABASE_ANON_KEY__
    ? window.__SUPABASE_ANON_KEY__
    : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kbGhienl5dWVpcnRkYWdqdXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTM2NjgsImV4cCI6MjA4NTQyOTY2OH0.gIMLhVg6nfR8gj6Yxv6CrNgbAZHt83OeD3Br6TZghCk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
