import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xpnkwmpzwvcfezimklwa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwbmt3bXB6d3ZjZmV6aW1rbHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxODg2OTIsImV4cCI6MjEwMTc2NDY5Mn0.J76_zFG4UuycVYsG4rXbfkux1KUnACizTYbZ6JF7ZEA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
