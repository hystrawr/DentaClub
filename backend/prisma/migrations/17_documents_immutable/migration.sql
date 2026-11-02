-- `immutable_flag` was only a label: nothing stopped an immutable document
-- (a signed consent) from being edited or deleted. This trigger refuses both,
-- for the app and for anyone working on the database directly.

CREATE FUNCTION "documents_guard_immutable"() RETURNS trigger AS $$
BEGIN
  IF OLD."immutable_flag" THEN
    RAISE EXCEPTION 'Document % is immutable and cannot be %', OLD."id", lower(TG_OP);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "documents_immutable"
BEFORE UPDATE OR DELETE ON "documents"
FOR EACH ROW EXECUTE FUNCTION "documents_guard_immutable"();
