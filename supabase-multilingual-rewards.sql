-- Add optional Burmese columns to rewards.
-- Existing rows keep NULL → frontend falls back to the English name/description.
ALTER TABLE rewards
  ADD COLUMN IF NOT EXISTS name_my    TEXT     CHECK (char_length(name_my)    <= 100),
  ADD COLUMN IF NOT EXISTS description_my TEXT  CHECK (char_length(description_my) <= 1000);

COMMENT ON COLUMN rewards.name_my         IS 'Burmese reward name. NULL = display name (English).';
COMMENT ON COLUMN rewards.description_my  IS 'Burmese description. NULL = display description (English).';