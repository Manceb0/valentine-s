/**
 * Plantilla de configuración Supabase.
 * Copia este archivo como supabaseClient.js y reemplaza con tus credenciales.
 * Añade supabaseClient.js al .gitignore para no subir la clave.
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "YOUR_SUPABASE_URL"; // ej: https://xxxx.supabase.co
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
