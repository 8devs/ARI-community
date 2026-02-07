import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Phone, ArrowLeft, Heart, Building2, Users, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileDetail {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  skills_text: string | null;
  first_aid_certified: boolean | null;
  phone: string | null;
  position: string | null;
  organization?: {
    name: string | null;
    logo_url?: string | null;
  } | null;
}

export default function PersonProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await api.query<{ data: ProfileDetail[] }>('/api/profiles');
        const found = res.data.find((p) => p.id === id) ?? null;
        if (!found) {
          toast.error('Profil konnte nicht geladen werden');
        } else {
          setProfile(found);
        }
      } catch (error) {
        toast.error('Profil konnte nicht geladen werden');
      }
      setLoading(false);
    };

    void loadProfile();
  }, [id]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const skills = profile?.skills_text
    ?.split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);

  return (
    <Layout>
      <div className="space-y-6">
        <Button variant="ghost" className="flex items-center gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Button>

        <Card>
          <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center">
            <Avatar className="h-32 w-32 border shadow">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.name} className="object-cover" />}
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {profile ? getInitials(profile.name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <CardTitle className="text-3xl font-bold">{profile?.name ?? 'Profil'}</CardTitle>
              {profile?.position && <p className="text-lg font-medium text-foreground">{profile.position}</p>}
              {profile?.organization?.name && (
                <p className="text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {profile.organization.name}
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-3">
                <Button variant="outline" asChild>
                  <a href={`mailto:${profile?.email}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Mail className="h-4 w-4 mr-2" /> E-Mail senden
                  </a>
                </Button>
                {profile?.phone && (
                  <Button variant="outline" asChild>
                    <a href={`tel:${profile.phone}`}>
                      <Phone className="h-4 w-4 mr-2" /> Anrufen
                    </a>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link to="/nachrichten">
                    <MessageCircle className="h-4 w-4 mr-2" /> Nachricht schreiben
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Über {profile?.name?.split(' ')[0] ?? 'dieses Mitglied'}</CardTitle>
              <CardDescription>Bio & Kompetenzen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile?.bio ? (
                <p className="text-sm text-muted-foreground whitespace-pre-line">{profile.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Beschreibung vorhanden.</p>
              )}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Skills & Tags</p>
                {skills && skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Skills hinterlegt.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Kontaktdaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{profile?.email}</span>
                </div>
                {profile?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile?.organization?.name && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.organization.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {profile?.first_aid_certified && (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-emerald-800">
                    <Heart className="h-4 w-4" /> Ersthelfer:in
                  </CardTitle>
                  <CardDescription>Dieses Teammitglied ist für Erste Hilfe zertifiziert.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
