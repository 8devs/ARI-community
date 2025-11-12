import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Mail, Heart, Users, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  skills_text: string | null;
  first_aid_certified: boolean | null;
  first_aid_available: boolean | null;
  phone: string | null;
  organization_id: string;
  organization?: {
    name: string | null;
  } | null;
}

export default function People() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOrgFilter = searchParams.get('organization') ?? 'all';
  const [organizationFilter, setOrganizationFilter] = useState(initialOrgFilter);

  useEffect(() => {
    loadProfiles();
    loadOrganizations();
  }, []);

  useEffect(() => {
    setOrganizationFilter(initialOrgFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrgFilter]);

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          avatar_url,
          bio,
          skills_text,
          first_aid_certified,
          first_aid_available,
          phone,
          organization_id,
          organization:organizations(name)
        `)
        .order('name');
      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error('Error loading profiles', error);
      toast.error('Profile konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setOrganizations(data || []);
    } catch (error: any) {
      console.error('Error loading organizations', error);
    }
  };

  const filtered = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return profiles.filter((profile) => {
      const matchesSearch =
        profile.name.toLowerCase().includes(search) ||
        profile.email.toLowerCase().includes(search) ||
        profile.skills_text?.toLowerCase().includes(search) ||
        profile.organization?.name?.toLowerCase().includes(search) ||
        profile.phone?.toLowerCase().includes(search);

      const matchesOrg =
        organizationFilter === 'all' || profile.organization_id === organizationFilter;

      return matchesSearch && matchesOrg;
    });
  }, [profiles, searchTerm, organizationFilter]);

  const handleOrganizationFilterChange = (value: string) => {
    setOrganizationFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === 'all') {
      next.delete('organization');
    } else {
      next.set('organization', value);
    }
    setSearchParams(next);
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Who-is-Who</h1>
          <p className="text-lg text-muted-foreground">
            Finde schnell Kolleg:innen aus allen Organisationen.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Nach Name, Organisation oder Skills suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={organizationFilter} onValueChange={handleOrganizationFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Organisation filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Organisationen</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Profile werden geladen...
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">
                {searchTerm ? 'Keine Profile gefunden' : 'Noch keine Profile vorhanden.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((profile) => (
              <Card key={profile.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14">
                      {profile.avatar_url && (
                        <AvatarImage
                          src={profile.avatar_url}
                          alt={profile.name}
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                        {getInitials(profile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{profile.name}</CardTitle>
                      {profile.organization?.name && (
                        <p className="text-sm text-muted-foreground truncate">
                          {profile.organization.name}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {profile.bio}
                    </p>
                  )}

                  {profile.skills_text && (
                    <div className="flex flex-wrap gap-1">
                      {profile.skills_text.split(',').slice(0, 3).map((skill, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {skill.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${profile.email}`} className="hover:text-primary truncate">
                      {profile.email}
                    </a>
                  </div>

                  {profile.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${profile.phone}`} className="hover:text-primary">
                        {profile.phone}
                      </a>
                    </div>
                  )}

                  {profile.first_aid_certified && (
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium">Ersthelfer</span>
                      {profile.first_aid_available && (
                        <Badge variant="outline" className="text-xs border-success text-success">
                          Verfügbar
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
