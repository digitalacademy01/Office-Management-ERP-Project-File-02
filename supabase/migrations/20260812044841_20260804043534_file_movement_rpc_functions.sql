CREATE OR REPLACE FUNCTION take_file(
  p_file_id uuid,
  p_taken_by_id uuid,
  p_taken_date timestamptz,
  p_purpose text DEFAULT NULL,
  p_expected_return_date timestamptz DEFAULT NULL,
  p_remarks text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_movement_id text;
  v_movement uuid;
  v_result json;
  v_existing_count int;
BEGIN
  SELECT count(*) INTO v_existing_count
  FROM file_movements
  WHERE file_id = p_file_id
    AND status = 'out'
    AND is_deleted = false;

  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'This file is already taken out. Please return it before taking it again.';
  END IF;

  v_movement_id := 'MV' || lpad(extract(epoch from now())::bigint::text, 10, '0');

  INSERT INTO file_movements (
    movement_id, file_id, taken_by_id, purpose,
    taken_date, expected_return_date, remarks,
    status, created_by, is_deleted
  ) VALUES (
    v_movement_id, p_file_id, p_taken_by_id, p_purpose,
    p_taken_date, p_expected_return_date, p_remarks,
    'out', p_created_by, false
  ) RETURNING id INTO v_movement;

  UPDATE physical_files
  SET status = 'in_use',
      current_holder_id = p_taken_by_id,
      last_movement_date = now(),
      updated_at = now()
  WHERE id = p_file_id;

  SELECT json_build_object(
    'id', fm.id,
    'movement_id', fm.movement_id,
    'file_id', fm.file_id,
    'status', fm.status,
    'taken_date', fm.taken_date
  ) INTO v_result
  FROM file_movements fm
  WHERE fm.id = v_movement;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION return_file(
  p_movement_id uuid,
  p_returned_by_id uuid,
  p_returned_date timestamptz,
  p_received_by_id uuid DEFAULT NULL,
  p_return_remarks text DEFAULT NULL,
  p_updated_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_file_id uuid;
  v_result json;
BEGIN
  SELECT file_id INTO v_file_id FROM file_movements WHERE id = p_movement_id AND is_deleted = false;

  IF v_file_id IS NULL THEN
    RAISE EXCEPTION 'Movement record not found or already deleted';
  END IF;

  UPDATE file_movements
  SET status = 'returned',
      returned_date = p_returned_date,
      returned_by_id = p_returned_by_id,
      received_by_id = p_received_by_id,
      return_remarks = p_return_remarks
  WHERE id = p_movement_id;

  UPDATE physical_files
  SET status = 'available',
      current_holder_id = NULL,
      last_movement_date = now(),
      updated_at = now()
  WHERE id = v_file_id;

  SELECT json_build_object(
    'id', fm.id,
    'movement_id', fm.movement_id,
    'file_id', fm.file_id,
    'status', fm.status,
    'returned_date', fm.returned_date
  ) INTO v_result
  FROM file_movements fm
  WHERE fm.id = p_movement_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION take_file TO authenticated;
GRANT EXECUTE ON FUNCTION return_file TO authenticated;