/* Which Supabase project the Vendor Portal talks to. These are the same
   public values the Staff Portal uses (js/supabase-config.js there): the
   project URL and the publishable (anon) key. They are safe to ship — the
   portal only calls the vendor Edge Functions, and every table is locked
   to staff. */
window.VENDOR_PORTAL_CONFIG = {
    supabaseUrl: "https://ostaqjuawieqpwuhrvsm.supabase.co",
    anonKey: "sb_publishable_W1J14WASXA9shdqziBFjJg_qTtohpU9",
};
