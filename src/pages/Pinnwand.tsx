import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Plus, Pin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface InfoPost {
  id: string;
  title: string;
  content: string;
  audience: 'PUBLIC' | 'INTERNAL';
  pinned: boolean;
  created_at: string;
  created_by: {
    name: string;
  };
}

export default function Pinnwand() {
  const [posts, setPosts] = useState<InfoPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('info_posts')
        .select(`
          id,
          title,
          content,
          audience,
          pinned,
          created_at,
          created_by:profiles!info_posts_created_by_id_fkey(name)
        `)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      toast.error('Fehler beim Laden der Beiträge');
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Pinnwand</h1>
            <p className="text-lg text-muted-foreground">
              Aktuelle News und Ankündigungen aus der Community
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Neuer Beitrag
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Lädt Beiträge...
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Noch keine Beiträge</p>
              <p className="text-muted-foreground mb-4">
                Sei der Erste und teile etwas mit der Community!
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ersten Beitrag erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <Card key={post.id} className={post.pinned ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl">{post.title}</CardTitle>
                        {post.pinned && (
                          <Pin className="h-4 w-4 text-primary fill-primary" />
                        )}
                      </div>
                      <CardDescription>
                        Von {post.created_by.name} • {' '}
                        {formatDistanceToNow(new Date(post.created_at), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </CardDescription>
                    </div>
                    <Badge variant={post.audience === 'PUBLIC' ? 'default' : 'secondary'}>
                      {post.audience === 'PUBLIC' ? 'Öffentlich' : 'Intern'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {post.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
