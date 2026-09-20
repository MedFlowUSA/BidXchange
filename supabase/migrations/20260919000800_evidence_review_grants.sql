-- Supabase default privileges can grant new views and sequences broadly.
revoke all on public.current_evidence_use_reviews from public,anon,authenticated;
grant select on public.current_evidence_use_reviews to authenticated;
revoke all on sequence public.evidence_use_reviews_sequence_seq from public,anon,authenticated;
grant usage on sequence public.evidence_use_reviews_sequence_seq to authenticated;
