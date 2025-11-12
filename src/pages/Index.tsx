import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    name: string;
  };
}

const Index = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<InfoPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPosts();
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
        .limit(5);

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      console.error('Error loading public posts', error);
      toast.error('Öffentliche Beiträge konnten nicht geladen werden.');
    } finally {
      setLoading(false);
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
                      Von {post.created_by.name} •{' '}
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

          {!loading && posts.length > 0 && (
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
