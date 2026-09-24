# Supabase Production Checklist

1. Enable authenticated sessions for admin users.
2. Use strict Row Level Security for investor rows and response access.
3. Investors can read the public startup list for their event.
4. Investors can insert only their own response through a controlled server-side RPC/Edge Function path.
5. Investors can read only their own response records.
6. Admin users can read aggregate data according to the event role policy.
7. Stage clients can read only published stage metric versions and public stage state.
8. Never expose service-role secrets in browser code.
9. Audit every admin mutation.
