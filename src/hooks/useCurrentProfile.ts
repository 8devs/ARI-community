import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        organization:organizations(name, logo_url, cost_center_code)
      `)
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile', error);
      setProfile(null);
    } else {
      setProfile(data);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, refresh: fetchProfile };
}
