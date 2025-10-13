"use client";

// @ts-ignore: optional dev dependency may not be installed in this environment yet
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // In client runtime we can't throw, but we log for developer awareness
  // The calling code should handle absence of client.
  // eslint-disable-next-line no-console
  console.warn("Supabase env variables are missing");
}

export const supabase = createClient(SUPABASE_URL || "", SUPABASE_ANON_KEY || "");
