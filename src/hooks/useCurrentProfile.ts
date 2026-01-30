import { useCallback, useEffect, useState } from 'react';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';

type Profile = Tables<'profiles'> & {
  organization?: {
    name: string | null;
    logo_url?: string | null;
    cost_center_code?: string | null;
  } | null;
};

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
