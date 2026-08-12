-- Make cabinet_id NOT NULL going forward, but preserve existing NULL records.
-- Step 1: Keep existing records as-is (NULL cabinet_id stays NULL for historical data)
-- Step 2: Set column to NOT NULL only if there are no existing NULLs
-- Since we can't guarantee no NULLs exist, we add a CHECK constraint for new inserts via a trigger instead.

-- Create a function that validates cabinet_id is not null on INSERT/UPDATE
CREATE OR REPLACE FUNCTION enforce_cabinet_required()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cabinet_id IS NULL THEN
    RAISE EXCEPTION 'Cabinet selection is required.';
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_enforce_cabinet ON physical_files;
CREATE TRIGGER trg_enforce_cabinet
  BEFORE INSERT OR UPDATE OF cabinet_id ON physical_files
  FOR EACH ROW
  EXECUTE FUNCTION enforce_cabinet_required();

-- Grant execute (the trigger runs with table owner privileges, no explicit grant needed)
-- But make sure the function is accessible
GRANT EXECUTE ON FUNCTION enforce_cabinet_required() TO authenticated;