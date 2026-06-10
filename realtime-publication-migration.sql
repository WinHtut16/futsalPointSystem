-- Enable REPLICA IDENTITY FULL and realtime publication for the three tables
-- that have live subscription consumers in the application.
--
-- REPLICA IDENTITY FULL: Postgres includes the complete new row in UPDATE events
-- (not just the primary key). Required for payload.new.total_points,
-- payload.new.status etc. to be present in realtime callbacks.
--
-- Safe to run on a live database: both operations are non-destructive.
-- REPLICA IDENTITY FULL is idempotent. The publication ADD TABLE guards
-- against duplicate-add errors if this was already configured via dashboard.

ALTER TABLE public.profiles          REPLICA IDENTITY FULL;
ALTER TABLE public.redemption_requests REPLICA IDENTITY FULL;
ALTER TABLE public.bookings          REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'redemption_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.redemption_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
END $$;
