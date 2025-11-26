-- Complete cleanup for profile deletions

ALTER TABLE public.answer_votes
  DROP CONSTRAINT IF EXISTS answer_votes_voter_id_fkey,
  ADD CONSTRAINT answer_votes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- resource_bookings does not have a created_by column; only requester/decider exist and are handled in the previous migration.
