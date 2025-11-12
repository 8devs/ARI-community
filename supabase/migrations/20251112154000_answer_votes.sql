-- Track per-user answer upvotes
ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS answer_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  answer_id UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (answer_id, voter_id)
);

ALTER TABLE answer_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are readable by authenticated users"
  ON answer_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can cast votes"
  ON answer_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = voter_id);

CREATE POLICY "Users can retract their votes"
  ON answer_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = voter_id);

-- Keep answer upvote counters in sync
CREATE OR REPLACE FUNCTION public.sync_answer_upvotes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE answers
      SET upvotes = COALESCE(upvotes, 0) + 1
    WHERE id = NEW.answer_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE answers
      SET upvotes = GREATEST(COALESCE(upvotes, 0) - 1, 0)
    WHERE id = OLD.answer_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS answer_votes_increment ON answer_votes;
DROP TRIGGER IF EXISTS answer_votes_decrement ON answer_votes;

CREATE TRIGGER answer_votes_increment
  AFTER INSERT ON answer_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_answer_upvotes();

CREATE TRIGGER answer_votes_decrement
  AFTER DELETE ON answer_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_answer_upvotes();

-- Ensure updated_at reflects edits
CREATE OR REPLACE FUNCTION public.touch_answers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS answers_set_updated_at ON answers;
CREATE TRIGGER answers_set_updated_at
  BEFORE UPDATE ON answers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_answers_updated_at();

-- Allow answer owners and admins to edit/delete answers
CREATE POLICY "Answer authors can update answers"
  ON answers FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_id)
  WITH CHECK (auth.uid() = created_by_id);

CREATE POLICY "Admins can update answers"
  ON answers FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Answer authors can delete answers"
  ON answers FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_id);

CREATE POLICY "Admins can delete answers"
  ON answers FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
