import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';

interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  skills_text: string | null;
  first_aid_certified: boolean | null;
  phone: string | null;
  position: string | null;
  role: string;
  organization_id: string | null;
  pref_email_notifications: boolean | null;
  pref_push_notifications: boolean | null;
  is_news_manager: boolean | null;
  is_event_manager: boolean | null;
  is_receptionist: boolean | null;
  created_at: string;
  organization?: {
    name: string | null;
    logo_url?: string | null;
    cost_center_code?: string | null;
  } | null;
}

export function useCurrentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/data/profile', { credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Profil konnte nicht geladen werden.');
      }
      const payload = await response.json();
      setProfile(payload.profile ?? null);
    } catch (error) {
      console.error('Error loading profile', error);
      setProfile(null);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, refresh: fetchProfile };
}
