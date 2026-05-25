-- point-adjustment-migration.sql
-- Run this in the Supabase SQL editor BEFORE deploying the adjustment feature.
--
-- The point_transactions.transaction_type column has a check constraint
-- that only allows 'earn' and 'redeem'. We need to add 'adjustment'.

ALTER TABLE public.point_transactions
  DROP CONSTRAINT point_transactions_transaction_type_check;

ALTER TABLE public.point_transactions
  ADD CONSTRAINT point_transactions_transaction_type_check
    CHECK (transaction_type IN ('earn', 'redeem', 'adjustment'));
