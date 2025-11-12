import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, Mail, Heart, Users, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';

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
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const { profile } = useCurrentProfile();
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'MEMBER',
    organization_id: '',
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    if (!profile || profile.role === 'MEMBER') return;
    if (profile.role === 'SUPER_ADMIN') {
      loadOrganizations();
    } else if (profile.organization_id) {
      setInviteForm(prev => ({ ...prev, organization_id: profile.organization_id! }));
    }
  }, [profile?.id, profile?.role, profile?.organization_id]);

  useEffect(() => {
    if (profile?.role === 'SUPER_ADMIN' && organizations.length && !inviteForm.organization_id) {
      setInviteForm(prev => ({ ...prev, organization_id: organizations[0].id }));
    }
  }, [organizations, profile?.role, inviteForm.organization_id]);

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

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setOrganizations(data || []);
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      toast.error('Organisationen konnten nicht geladen werden');
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (!inviteForm.email.trim() || !inviteForm.organization_id) {
      toast.error('E-Mail und Organisation sind erforderlich');
      return;
    }

    setCreatingInvite(true);
    try {
      const redirectTo = `${window.location.origin}/passwort/neu`;
      const { error } = await supabase.auth.signInWithOtp({
        email: inviteForm.email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
          data: {
            role: inviteForm.role,
            organization_id: inviteForm.organization_id,
            invited_by: profile.id,
          },
        },
      });

      if (error) throw error;

      toast.success('Einladungs-E-Mail wurde verschickt');
      setInviteForm(prev => ({
        ...prev,
        email: '',
        role: 'MEMBER',
      }));
    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast.error(error.message || 'Einladung konnte nicht gesendet werden');
    } finally {
      setCreatingInvite(false);
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

  const canInvite = profile && profile.role !== 'MEMBER';

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Who-is-Who</h1>
          <p className="text-lg text-muted-foreground">
            Lerne Deine Kollegen aus allen Unternehmen kennen
          </p>
        </div>

        {canInvite && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Mitarbeitende einladen</CardTitle>
                <CardDescription>
                  Supabase verschickt automatisch einen persönlichen Link per E-Mail.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleInviteSubmit}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">E-Mail-Adresse</label>
                    <Input
                      type="email"
                      placeholder="person@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  {profile?.role === 'SUPER_ADMIN' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Organisation</label>
                      <Select
                        value={inviteForm.organization_id}
                        onValueChange={(value) =>
                          setInviteForm(prev => ({ ...prev, organization_id: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Organisation auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map(org => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {profile?.role !== 'SUPER_ADMIN' && (
                    <div>
                      <label className="text-sm font-medium">Organisation</label>
                      <p className="text-sm text-muted-foreground">
                        {profile?.organization?.name ?? 'Nicht zugeordnet'}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rolle</label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(value) => setInviteForm(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Rolle wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Mitarbeiter</SelectItem>
                        <SelectItem value="ORG_ADMIN">Organisations-Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={creatingInvite}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {creatingInvite ? 'Wird eingeladen...' : 'Einladung senden'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Was passiert nach dem Versand?</CardTitle>
                <CardDescription>Kurze Erinnerung für Admins</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>• Supabase verschickt automatisch eine Magic-Link-Mail.</p>
                <p>• Nach dem Klick landet die Person auf <code>/passwort/neu</code> und vergibt ihr Passwort.</p>
                <p>• Rolle & Organisation übernehmen wir über die Meta-Daten – keine manuelle Zuordnung mehr nötig.</p>
                <Alert>
                  <AlertTitle>Tipp</AlertTitle>
                  <AlertDescription>
                    Im Supabase-Dashboard unter Auth → Logs kannst Du Versandfehler nachsehen, falls eine Mail nicht ankommt.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        )}

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
