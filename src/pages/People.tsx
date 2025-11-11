import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Search, Mail, Heart, Users, UserPlus, Copy, CheckCircle2, Trash2 } from 'lucide-react';
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

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  organization_id: string;
  organization?: {
    name: string | null;
  } | null;
  invited_by?: {
    name: string | null;
  } | null;
}

export default function People() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
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
    loadInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const loadInvitations = async () => {
    if (!profile || profile.role === 'MEMBER') return;
    setInvitationsLoading(true);
    try {
      let query = supabase
        .from('employee_invitations')
        .select(`
          id,
          email,
          role,
          token,
          created_at,
          expires_at,
          accepted_at,
          organization_id,
          organization:organizations(name),
          invited_by:profiles!employee_invitations_invited_by_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (profile.role !== 'SUPER_ADMIN') {
        query = query.eq('organization_id', profile.organization_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
      toast.error('Einladungen konnten nicht geladen werden');
    } finally {
      setInvitationsLoading(false);
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
      const { error } = await supabase.from('employee_invitations').insert({
        email: inviteForm.email.trim(),
        role: inviteForm.role,
        organization_id: inviteForm.organization_id,
        invited_by: profile.id,
      });
      if (error) throw error;
      toast.success('Einladung erstellt');
      setInviteForm(prev => ({
        ...prev,
        email: '',
        role: 'MEMBER',
        organization_id:
          profile.role === 'SUPER_ADMIN' ? prev.organization_id : profile.organization_id || '',
      }));
      loadInvitations();
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      toast.error(error.message || 'Einladung konnte nicht erstellt werden');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleDeleteInvitation = async (invitation: Invitation) => {
    if (invitation.accepted_at) return;
    try {
      const { error } = await supabase.from('employee_invitations').delete().eq('id', invitation.id);
      if (error) throw error;
      toast.success('Einladung gelöscht');
      loadInvitations();
    } catch (error: any) {
      console.error('Error deleting invitation:', error);
      toast.error('Einladung konnte nicht gelöscht werden');
    }
  };

  const handleCopyInviteLink = async (invitation: Invitation) => {
    const link = `${window.location.origin}/login?invite=${invitation.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedInviteId(invitation.id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch (error) {
      console.error('Clipboard error', error);
      toast.error('Link konnte nicht kopiert werden');
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
                  Organisationen können neue Kolleg:innen per E-Mail einladen. Einladung ist 14 Tage gültig.
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
                <CardTitle>Offene Einladungen</CardTitle>
                <CardDescription>
                  Überwache alle Einladungen. Angenommene Einladungen erscheinen automatisch im Mitgliederverzeichnis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {invitationsLoading ? (
                  <p className="text-sm text-muted-foreground">Einladungen werden geladen...</p>
                ) : invitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine Einladungen versendet.</p>
                ) : (
                  <div className="space-y-4">
                    {invitations.map(invitation => {
                      const isAccepted = Boolean(invitation.accepted_at);
                      const inviteLink = `${window.location.origin}/login?invite=${invitation.token}`;
                      return (
                        <div key={invitation.id} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{invitation.email}</p>
                              <p className="text-sm text-muted-foreground">
                                {invitation.organization?.name || 'Organisation unbekannt'} • {invitation.role}
                              </p>
                            </div>
                            <Badge variant={isAccepted ? 'secondary' : 'default'}>
                              {isAccepted ? 'Angenommen' : 'Ausstehend'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Erstellt am {new Date(invitation.created_at).toLocaleDateString('de-DE')}
                            {' • '}Gültig bis {new Date(invitation.expires_at).toLocaleDateString('de-DE')}
                          </div>
                          {!isAccepted && (
                            <>
                              <Separator />
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="px-2 py-1 rounded bg-muted text-xs break-all flex-1">
                                  {inviteLink}
                                </code>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleCopyInviteLink(invitation)}
                                >
                                  {copiedInviteId === invitation.id ? (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                      Kopiert
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4 mr-1" />
                                      Link kopieren
                                    </>
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => handleDeleteInvitation(invitation)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Löschen
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
