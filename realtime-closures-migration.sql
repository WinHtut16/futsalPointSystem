-- Enable REPLICA IDENTITY FULL and realtime publication for court_closures.
-- Required so that closure INSERT/UPDATE/DELETE events carry the full row
-- (including closure_date) in the payload, which the booking slot realtime
-- hook uses to trigger per-date availability refreshes on the customer
-- booking page.
--
-- Safe to run on a live database: both operations are non-destructive.

ALTER TABLE public.court_closures REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'court_closures'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.court_closures;
  END IF;
END $$;
