import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Mail, Heart, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  skills_text: string | null;
  first_aid_certified: boolean;
  first_aid_available: boolean;
  organization: {
    name: string;
  } | null;
}

export default function People() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          bio,
          skills_text,
          first_aid_certified,
          first_aid_available,
          organization:organizations(name)
        `)
        .order('name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      toast.error('Fehler beim Laden der Profile');
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(profile => {
    const search = searchTerm.toLowerCase();
    return (
      profile.name.toLowerCase().includes(search) ||
      profile.email.toLowerCase().includes(search) ||
      profile.skills_text?.toLowerCase().includes(search) ||
      profile.organization?.name.toLowerCase().includes(search)
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Who-is-Who</h1>
          <p className="text-lg text-muted-foreground">
            Lerne Deine Kollegen aus allen Unternehmen kennen
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Nach Name, Organisation oder Skills suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Lädt Profile...
          </div>
        ) : filteredProfiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">
                {searchTerm ? 'Keine Profile gefunden' : 'Noch keine Profile vorhanden'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProfiles.map(profile => (
              <Card key={profile.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                        {getInitials(profile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{profile.name}</CardTitle>
                      {profile.organization && (
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
                    <a 
                      href={`mailto:${profile.email}`}
                      className="hover:text-primary truncate"
                    >
                      {profile.email}
                    </a>
                  </div>

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
