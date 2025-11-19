-- Add inventory and notification metadata to rooms
alter table public.rooms
  add column chairs_capacity integer,
  add column chairs_default integer,
  add column tables_capacity integer,
  add column tables_default integer,
  add column requires_beverage_catering boolean not null default false,
  add column notify_on_booking boolean not null default false,
  add column booking_notify_email text,
  add column info_document_url text,
  add column public_share_token uuid not null default gen_random_uuid();

create unique index if not exists rooms_public_share_token_key on public.rooms(public_share_token);

-- extend bookings with attendee & equipment requirements
alter table public.room_bookings
  add column expected_attendees integer,
  add column chairs_needed integer,
  add column tables_needed integer;
