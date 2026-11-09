import { createClient } from "@supabase/supabase-js";

// A chave publicável é pública por natureza: quem protege os dados são as políticas RLS no banco.
// Em produção, as duas variáveis chegam como build args (ver Dockerfile e README).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

if (!url || !key) {
  throw new Error("Faltam VITE_SUPABASE_URL e VITE_SUPABASE_KEY (copie .env.example para .env).");
}

export const sb = createClient(url, key);
export const BUCKET = "banco-questoes";
