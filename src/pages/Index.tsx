import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Loader2, Newspaper } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface InfoPost {
  id: string;
  title: string;
  content: string;
  created_at: string;
  pinned: boolean;
  created_by: {
    name: string | null;
  } | null;
}

const Index = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<InfoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const PUBLIC_POST_LIMIT = 5;
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [joinForm, setJoinForm] = useState({
    name: '',
    email: '',
    organization_id: '',
  });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadPublicPosts();
    loadOrganizations();
  }, []);

  const loadPublicPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('info_posts')
        .select(`
          id,
          title,
          content,
          created_at,
          pinned,
          created_by:profiles!info_posts_created_by_id_fkey(name)
        `)
        .eq('audience', 'PUBLIC')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(PUBLIC_POST_LIMIT);

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      console.error('Error loading public posts', error);
      toast.error('Öffentliche Beiträge konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!joinForm.name.trim() || !joinForm.email.trim() || !joinForm.organization_id) {
      toast.error('Bitte fülle alle Felder aus.');
      return;
    }
    setJoining(true);
    try {
      const { error } = await supabase.functions.invoke('submit-join-request', {
        body: {
          name: joinForm.name.trim(),
          email: joinForm.email.trim(),
          organization_id: joinForm.organization_id,
        },
      });
      if (error) throw error;
      toast.success('Vielen Dank! Wir prüfen Deine Anfrage zeitnah.');
      setJoinForm({
        name: '',
        email: '',
        organization_id: '',
      });
    } catch (error: any) {
      console.error('Error submitting join request', error);
      toast.error(error.message ?? 'Anfrage konnte nicht gesendet werden.');
    } finally {
      setJoining(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase.from('organizations').select('id, name').order('name');
      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations', error);
    }
  };

  return (
    <Layout>
      <div className="space-y-12">
        <section className="text-center space-y-4 py-12">
          <Badge variant="outline" className="text-sm">
            Adenauerring Community
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Willkommen am Adenauerring
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Hier findest Du alle Neuigkeiten, Veranstaltungen und hilfreiche Kontakte der Campus-Community.
            Öffentliche Beiträge sind jederzeit sichtbar – für weitere Funktionen bitte anmelden.
          </p>
          <div className="flex justify-center gap-4">
            {user ? (
              <Button asChild size="lg">
                <Link to="/app">Zum Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link to="/login">Anmelden</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/pinnwand">Zur Pinnwand</Link>
                </Button>
              </>
            )}
          </div>
        </section>

        {!user && (
          <section className="grid gap-6 md:grid-cols-2 items-center">
            <div className="space-y-4">
              <h2 className="text-3xl font-semibold">Zugang anfragen</h2>
              <p className="text-muted-foreground">
                Du möchtest Teil der ARI Community werden? Sende uns eine Beitrittsanfrage und der zuständige
                Organisations-Admin meldet sich bei Dir.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Nur berufliche E-Mail-Adressen verwenden</li>
                <li>Die Mitgliedschaft wird manuell bestätigt</li>
                <li>Du erhältst eine Einladung per E-Mail</li>
              </ul>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Beitrittsanfrage senden</CardTitle>
                <CardDescription>Wir benötigen nur ein paar Angaben, um Dich der richtigen Organisation zuzuordnen.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleJoinRequest}>
                  <div className="space-y-2">
                    <Label htmlFor="join-name">Voller Name</Label>
                    <Input
                      id="join-name"
                      value={joinForm.name}
                      onChange={(e) => setJoinForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Max Mustermann"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-email">E-Mail-Adresse</Label>
                    <Input
                      id="join-email"
                      type="email"
                      value={joinForm.email}
                      onChange={(e) => setJoinForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="vorname.nachname@unternehmen.de"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Organisation</Label>
                    <Select
                      value={joinForm.organization_id}
                      onValueChange={(value) => setJoinForm((prev) => ({ ...prev, organization_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Organisation auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={joining}>
                    {joining ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Wird gesendet...
                      </>
                    ) : (
                      'Anfrage abschicken'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Öffentliche Pinnwand</h2>
              <p className="text-muted-foreground">
                Einblicke in aktuelle Themen – ohne Login sichtbar.
              </p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/pinnwand">Alle Beiträge</Link>
            </Button>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Beiträge werden geladen...
              </CardContent>
            </Card>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Noch keine öffentlichen Beiträge vorhanden.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {posts.map((post) => (
                <Card key={post.id} className={post.pinned ? 'border-primary' : ''}>
                  <CardHeader className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-xl">{post.title}</CardTitle>
                      {post.pinned && (
                        <Badge variant="default">Top</Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      Von {post.created_by?.name ?? 'Unbekannt'} •{' '}
                      {formatDistanceToNow(new Date(post.created_at), {
                        addSuffix: true,
                        locale: de,
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap line-clamp-4">
                      {post.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && posts.length === PUBLIC_POST_LIMIT && (
            <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Newspaper className="h-4 w-4" />
              Tipp: Noch mehr Themen findest Du auf der{" "}
              <Link to="/pinnwand" className="text-primary underline-offset-4 hover:underline">
                kompletten Pinnwand
              </Link>.
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default Index;
