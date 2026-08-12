ALTER TABLE physical_files
  ADD COLUMN IF NOT EXISTS file_subject text,
  ADD COLUMN IF NOT EXISTS assessment_year text,
  ADD COLUMN IF NOT EXISTS financial_year text;