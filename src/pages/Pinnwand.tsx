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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';

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
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    audience: 'INTERNAL' as InfoPost['audience'],
    pinned: false,
  });
  const { user } = useAuth();

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

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast.error('Du musst angemeldet sein, um zu posten');
      return;
    }
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast.error('Titel und Inhalt sind erforderlich');
      return;
    }

    setCreating(true);
    const { error } = await supabase.from('info_posts').insert({
      title: newPost.title.trim(),
      content: newPost.content.trim(),
      audience: newPost.audience,
      pinned: newPost.pinned,
      created_by_id: user.id,
    });

    if (error) {
      console.error('Error creating post:', error);
      toast.error('Beitrag konnte nicht erstellt werden');
    } else {
      toast.success('Beitrag veröffentlicht');
      setNewPost({ title: '', content: '', audience: 'INTERNAL', pinned: false });
      setDialogOpen(false);
      loadPosts();
    }
    setCreating(false);
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
          <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neuer Beitrag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Beitrag erstellen</DialogTitle>
                <DialogDescription>
                  Teile Neuigkeiten oder wichtige Hinweise mit Deiner Organisation oder allen Gästen.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreatePost}>
                <div className="space-y-2">
                  <Label htmlFor="post-title">Titel</Label>
                  <Input
                    id="post-title"
                    value={newPost.title}
                    onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-content">Inhalt</Label>
                  <Textarea
                    id="post-content"
                    value={newPost.content}
                    onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                    rows={5}
                    placeholder="Deine Nachricht an die Community..."
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Sichtbarkeit</Label>
                    <Select
                      value={newPost.audience}
                      onValueChange={(value: InfoPost['audience']) =>
                        setNewPost(prev => ({ ...prev, audience: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sichtbarkeit wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTERNAL">Nur intern</SelectItem>
                        <SelectItem value="PUBLIC">Öffentlich</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Anpinnen</p>
                      <p className="text-sm text-muted-foreground">Wird oben auf der Pinnwand angezeigt</p>
                    </div>
                    <Switch
                      checked={newPost.pinned}
                      onCheckedChange={(checked) => setNewPost(prev => ({ ...prev, pinned: checked }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Wird veröffentlicht...' : 'Beitrag veröffentlichen'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
              <Button onClick={() => setDialogOpen(true)}>
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
