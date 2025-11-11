-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE app_role AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'MEMBER');
CREATE TYPE audience_type AS ENUM ('PUBLIC', 'INTERNAL');
CREATE TYPE booking_status AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'CANCELLED');
CREATE TYPE report_status AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE report_target AS ENUM ('QUESTION', 'ANSWER', 'POST');
CREATE TYPE listing_kind AS ENUM ('OFFER', 'REQUEST', 'LOST_FOUND', 'RIDESHARE');
CREATE TYPE match_kind AS ENUM ('LUNCH');
CREATE TYPE match_status AS ENUM ('DRAFT', 'OPEN', 'PAIRED', 'CLOSED');
CREATE TYPE notification_type AS ENUM ('INFO', 'EVENT', 'QNA', 'BOOKING', 'LUNCH', 'COFFEE', 'POLL');

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  cost_center_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users/Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'MEMBER',
  organization_id UUID REFERENCES organizations(id),
  bio TEXT,
  skills_text TEXT,
  first_aid_certified BOOLEAN DEFAULT FALSE,
  first_aid_available BOOLEAN DEFAULT FALSE,
  first_aid_available_since TIMESTAMPTZ,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Info posts / Pinnwand
CREATE TABLE info_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience audience_type NOT NULL DEFAULT 'INTERNAL',
  created_by_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pinned BOOLEAN DEFAULT FALSE
);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_open_to_all BOOLEAN DEFAULT TRUE,
  audience_group TEXT,
  description TEXT,
  external_registration_url TEXT,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Questions (Q&A)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[],
  created_by_id UUID NOT NULL REFERENCES profiles(id),
  is_solved BOOLEAN DEFAULT FALSE,
  accepted_answer_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Answers (Q&A)
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by_id UUID NOT NULL REFERENCES profiles(id),
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reports (Meldungen)
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type report_target NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  created_by_id UUID NOT NULL REFERENCES profiles(id),
  status report_status DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Market listings (Suche & Biete)
CREATE TABLE market_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind listing_kind NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  contact TEXT NOT NULL,
  image_url TEXT,
  created_by_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Rooms
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  capacity INTEGER,
  equipment_text TEXT
);

-- Resource bookings
CREATE TABLE resource_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  requester_id UUID NOT NULL REFERENCES profiles(id),
  status booking_status DEFAULT 'REQUESTED',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  decided_by_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Polls
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  options TEXT[] NOT NULL,
  closes_at TIMESTAMPTZ,
  created_by_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Poll votes
CREATE TABLE poll_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- Kudos
CREATE TABLE kudos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES profiles(id),
  to_user_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coffee products
CREATE TABLE coffee_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Coffee transactions
CREATE TABLE coffee_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  product_id UUID NOT NULL REFERENCES coffee_products(id),
  product_name_snapshot TEXT NOT NULL,
  price_cents_snapshot INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lunch rounds (Sammelbestellung)
CREATE TABLE lunch_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  responsible_user_id UUID NOT NULL REFERENCES profiles(id),
  deadline_at TIMESTAMPTZ NOT NULL,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lunch options
CREATE TABLE lunch_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES lunch_rounds(id) ON DELETE CASCADE,
  label TEXT NOT NULL
);

-- Lunch orders
CREATE TABLE lunch_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES lunch_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  option_id UUID NOT NULL REFERENCES lunch_options(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(round_id, user_id)
);

-- Match rounds (Lunch Roulette)
CREATE TABLE match_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind match_kind NOT NULL DEFAULT 'LUNCH',
  scheduled_date DATE NOT NULL,
  status match_status DEFAULT 'DRAFT',
  weekday INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Match participations
CREATE TABLE match_participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES match_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  UNIQUE(round_id, user_id)
);

-- Match pairs
CREATE TABLE match_pairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES match_rounds(id) ON DELETE CASCADE,
  user_a_id UUID NOT NULL REFERENCES profiles(id),
  user_b_id UUID NOT NULL REFERENCES profiles(id)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  read_at TIMESTAMPTZ,
  type notification_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings (key-value store)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE info_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE kudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lunch_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE lunch_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE lunch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin (org or super)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role IN ('ORG_ADMIN', 'SUPER_ADMIN')
  )
$$;

-- RLS Policies

-- Organizations: All authenticated users can read
CREATE POLICY "Organizations are viewable by all authenticated users"
  ON organizations FOR SELECT
  TO authenticated
  USING (true);

-- Profiles: All authenticated users can read all profiles
CREATE POLICY "Profiles are viewable by all authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Info posts: Public posts viewable by anyone, internal only by authenticated
CREATE POLICY "Public posts are viewable by everyone"
  ON info_posts FOR SELECT
  USING (audience = 'PUBLIC');

CREATE POLICY "Internal posts viewable by authenticated users"
  ON info_posts FOR SELECT
  TO authenticated
  USING (audience = 'INTERNAL');

CREATE POLICY "Authenticated users can create posts"
  ON info_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_id);

-- Events: All authenticated users can read and create
CREATE POLICY "Events are viewable by authenticated users"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Questions: All authenticated users can read and create
CREATE POLICY "Questions are viewable by authenticated users"
  ON questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create questions"
  ON questions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_id);

CREATE POLICY "Question creators can update their questions"
  ON questions FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_id);

-- Answers: All authenticated users can read and create
CREATE POLICY "Answers are viewable by authenticated users"
  ON answers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create answers"
  ON answers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_id);

-- Reports: Creators and admins can read
CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by_id OR public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_id);

CREATE POLICY "Admins can update reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Market listings: All authenticated users can read and create
CREATE POLICY "Market listings are viewable by authenticated users"
  ON market_listings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create listings"
  ON market_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_id);

-- Rooms: All authenticated users can view
CREATE POLICY "Rooms are viewable by authenticated users"
  ON rooms FOR SELECT
  TO authenticated
  USING (true);

-- Resource bookings: All authenticated users can view and create
CREATE POLICY "Bookings are viewable by authenticated users"
  ON resource_bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create bookings"
  ON resource_bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Admins can update bookings"
  ON resource_bookings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Polls: All authenticated users can read and create
CREATE POLICY "Polls are viewable by authenticated users"
  ON polls FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create polls"
  ON polls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_id);

-- Poll votes: Users can read all and create their own
CREATE POLICY "Poll votes are viewable by authenticated users"
  ON poll_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can vote"
  ON poll_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Kudos: All authenticated users can read and create
CREATE POLICY "Kudos are viewable by authenticated users"
  ON kudos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can give kudos"
  ON kudos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

-- Coffee products: All authenticated users can read
CREATE POLICY "Coffee products are viewable by authenticated users"
  ON coffee_products FOR SELECT
  TO authenticated
  USING (true);

-- Coffee transactions: Users can view their own, admins can view all
CREATE POLICY "Users can view their own coffee transactions"
  ON coffee_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can create coffee transactions"
  ON coffee_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Lunch rounds: All authenticated users can read and create
CREATE POLICY "Lunch rounds are viewable by authenticated users"
  ON lunch_rounds FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create lunch rounds"
  ON lunch_rounds FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = responsible_user_id);

-- Lunch options: All authenticated users can read
CREATE POLICY "Lunch options are viewable by authenticated users"
  ON lunch_options FOR SELECT
  TO authenticated
  USING (true);

-- Lunch orders: All authenticated users can read and create
CREATE POLICY "Lunch orders are viewable by authenticated users"
  ON lunch_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create lunch orders"
  ON lunch_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Match rounds: All authenticated users can read
CREATE POLICY "Match rounds are viewable by authenticated users"
  ON match_rounds FOR SELECT
  TO authenticated
  USING (true);

-- Match participations: All authenticated users can read and create
CREATE POLICY "Match participations are viewable by authenticated users"
  ON match_participations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can participate"
  ON match_participations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Match pairs: All authenticated users can read
CREATE POLICY "Match pairs are viewable by authenticated users"
  ON match_pairs FOR SELECT
  TO authenticated
  USING (true);

-- Notifications: Users can only see their own
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Settings: Admins only
CREATE POLICY "Admins can view settings"
  ON settings FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update settings"
  ON settings FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Neuer Nutzer'),
    'MEMBER'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();