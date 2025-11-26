-- Ensure users can be deleted without foreign key violations by cascading or nulling references

-- Core content owned by a profile should be removed with the user
ALTER TABLE public.info_posts
  DROP CONSTRAINT IF EXISTS info_posts_created_by_id_fkey,
  ADD CONSTRAINT info_posts_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_owner_id_fkey,
  ADD CONSTRAINT events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_created_by_id_fkey,
  ADD CONSTRAINT questions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.answers
  DROP CONSTRAINT IF EXISTS answers_created_by_id_fkey,
  ADD CONSTRAINT answers_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_created_by_id_fkey,
  ADD CONSTRAINT reports_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.market_listings
  DROP CONSTRAINT IF EXISTS market_listings_created_by_id_fkey,
  ADD CONSTRAINT market_listings_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_created_by_id_fkey,
  ADD CONSTRAINT polls_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.poll_votes
  DROP CONSTRAINT IF EXISTS poll_votes_user_id_fkey,
  ADD CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.kudos
  DROP CONSTRAINT IF EXISTS kudos_from_user_id_fkey,
  DROP CONSTRAINT IF EXISTS kudos_to_user_id_fkey,
  ADD CONSTRAINT kudos_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT kudos_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.coffee_transactions
  DROP CONSTRAINT IF EXISTS coffee_transactions_user_id_fkey,
  ADD CONSTRAINT coffee_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.lunch_rounds
  DROP CONSTRAINT IF EXISTS lunch_rounds_responsible_user_id_fkey,
  ADD CONSTRAINT lunch_rounds_responsible_user_id_fkey FOREIGN KEY (responsible_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.lunch_orders
  DROP CONSTRAINT IF EXISTS lunch_orders_user_id_fkey,
  ADD CONSTRAINT lunch_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.match_participations
  DROP CONSTRAINT IF EXISTS match_participations_user_id_fkey,
  ADD CONSTRAINT match_participations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.match_pairs
  DROP CONSTRAINT IF EXISTS match_pairs_user_a_id_fkey,
  DROP CONSTRAINT IF EXISTS match_pairs_user_b_id_fkey,
  ADD CONSTRAINT match_pairs_user_a_id_fkey FOREIGN KEY (user_a_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT match_pairs_user_b_id_fkey FOREIGN KEY (user_b_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.resource_bookings
  DROP CONSTRAINT IF EXISTS resource_bookings_requester_id_fkey,
  DROP CONSTRAINT IF EXISTS resource_bookings_decided_by_id_fkey,
  ADD CONSTRAINT resource_bookings_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT resource_bookings_decided_by_id_fkey FOREIGN KEY (decided_by_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Later additions that also point to profiles
ALTER TABLE public.join_requests
  DROP CONSTRAINT IF EXISTS join_requests_approved_by_fkey,
  ADD CONSTRAINT join_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.lunch_places
  DROP CONSTRAINT IF EXISTS lunch_places_created_by_fkey,
  ADD CONSTRAINT lunch_places_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
