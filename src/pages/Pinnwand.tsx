import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Plus, Pin, Edit, Trash2, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';

interface InfoPost {
  id: string;
  title: string;
  content: string;
  audience: 'PUBLIC' | 'INTERNAL' | 'ORG_ONLY';
  pinned: boolean;
  created_at: string;
  created_by_id: string;
  created_by: {
    name: string | null;
  } | null;
  attachment_url: string | null;
  target_organization_id: string | null;
  target_organization?: {
    name: string | null;
  } | null;
}

export default function Pinnwand() {
  const [posts, setPosts] = useState<InfoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    audience: 'INTERNAL' as InfoPost['audience'],
    pinned: false,
    attachment_url: null as string | null,
    target_organization_id: null as string | null,
  });
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const { profile } = useCurrentProfile();
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [availableOrgs, setAvailableOrgs] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadPosts();
  }, [isAuthenticated]);

  useEffect(() => {
    if (profile?.role === 'SUPER_ADMIN') {
      loadOrganizations();
    }
  }, [profile?.role]);

  const loadPosts = async () => {
    try {
      let query = supabase
        .from('info_posts')
        .select(`
          id,
          title,
          content,
          audience,
          pinned,
          created_at,
          created_by_id,
          attachment_url,
          target_organization_id,
          created_by:profiles!info_posts_created_by_id_fkey(name),
          target_organization:organizations(name)
        `)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (!isAuthenticated) {
        query = query.eq('audience', 'PUBLIC');
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      toast.error('Fehler beim Laden der Beiträge');
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase.from('organizations').select('id, name').order('name');
      if (error) throw error;
      setAvailableOrgs(data || []);
    } catch (error) {
      console.error('Error loading organizations', error);
    }
  };

  const triggerPostNotifications = async (postId: string) => {
    try {
      const { error } = await supabase.functions.invoke('notify-info-post', {
        body: { post_id: postId },
      });
      if (error) {
        console.error('notify-info-post failed', error);
      }
    } catch (error) {
      console.error('notify-info-post unexpected', error);
    }
  };

  const openCreateDialog = () => {
    setEditingPostId(null);
    setNewPost({
      title: '',
      content: '',
      audience: 'INTERNAL',
      pinned: false,
      attachment_url: null,
      target_organization_id: profile?.organization_id ?? null,
    });
    setAttachmentFile(null);
    setRemoveAttachment(false);
    setDialogOpen(true);
  };

  const openEditDialog = (post: InfoPost) => {
    setEditingPostId(post.id);
    setNewPost({
      title: post.title,
      content: post.content,
      audience: post.audience,
      pinned: post.pinned,
      attachment_url: post.attachment_url,
      target_organization_id: post.target_organization_id ?? profile?.organization_id ?? null,
    });
    setAttachmentFile(null);
    setRemoveAttachment(false);
    setDialogOpen(true);
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast.error('Du musst angemeldet sein, um zu posten');
      return;
    }
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast.error('Titel und Inhalt sind erforderlich');
      return;
    }

    let targetOrgId =
      newPost.audience === 'ORG_ONLY'
        ? newPost.target_organization_id ?? profile?.organization_id ?? null
        : null;

    if (newPost.audience === 'ORG_ONLY' && !targetOrgId) {
      toast.error('Bitte wähle eine Organisation für org-interne Beiträge.');
      return;
    }

    setCreating(true);
    try {
      let attachmentUrl = newPost.attachment_url;
      if (removeAttachment) {
        attachmentUrl = null;
      }
      if (attachmentFile) {
        attachmentUrl = await uploadAttachment(attachmentFile);
      }

      let error;
      let insertedPostId: string | null = null;
      if (editingPostId) {
        ({ error } = await supabase
          .from('info_posts')
          .update({
            title: newPost.title.trim(),
            content: newPost.content.trim(),
            audience: newPost.audience,
            pinned: newPost.pinned,
            attachment_url: attachmentUrl,
            target_organization_id: targetOrgId,
          })
          .eq('id', editingPostId));
      } else {
        const { data, error: insertError } = await supabase
          .from('info_posts')
          .insert({
            title: newPost.title.trim(),
            content: newPost.content.trim(),
            audience: newPost.audience,
            pinned: newPost.pinned,
            attachment_url: attachmentUrl,
            target_organization_id: targetOrgId,
            created_by_id: user.id,
          })
          .select('id')
          .single();
        error = insertError;
        insertedPostId = data?.id ?? null;
      }

      if (error) {
        throw error;
      }

      toast.success(editingPostId ? 'Beitrag aktualisiert' : 'Beitrag veröffentlicht');
      setNewPost({
        title: '',
        content: '',
        audience: 'INTERNAL',
        pinned: false,
        attachment_url: null,
        target_organization_id: profile?.organization_id ?? null,
      });
      setAttachmentFile(null);
      setRemoveAttachment(false);
      setEditingPostId(null);
      setDialogOpen(false);
      loadPosts();
      if (!editingPostId && insertedPostId) {
        void triggerPostNotifications(insertedPostId);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Beitrag konnte nicht gespeichert werden');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    setDeletingId(postId);
    const { error } = await supabase.from('info_posts').delete().eq('id', postId);
    if (error) {
      console.error('Error deleting post:', error);
      toast.error('Beitrag konnte nicht gelöscht werden');
    } else {
      toast.success('Beitrag gelöscht');
      loadPosts();
    }
    setDeletingId(null);
  };

  const canManagePosts = Boolean(profile?.is_news_manager || profile?.role === 'SUPER_ADMIN');
  const canManagePost = (post: InfoPost) => {
    if (!user?.id) return false;
    if (profile?.role === 'SUPER_ADMIN') return true;
    return profile?.is_news_manager && user.id === post.created_by_id;
  };
  const canSelectTargetOrg = profile?.role === 'SUPER_ADMIN';

  const generateAttachmentPath = (file: File) => {
    const ext = file.name.split('.').pop();
    const randomId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `attachments/${randomId}.${ext}`;
  };

  const uploadAttachment = async (file: File) => {
    const filePath = generateAttachmentPath(file);
    const { error } = await supabase.storage.from('info-post-attachments').upload(filePath, file, {
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('info-post-attachments').getPublicUrl(filePath);
    return data.publicUrl;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold mb-2">Pinnwand</h1>
            <p className="text-lg text-muted-foreground">
              Aktuelle News und Ankündigungen aus der Community
            </p>
          </div>
          {canManagePosts ? (
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  setAttachmentFile(null);
                  setRemoveAttachment(false);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Neuer Beitrag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPostId ? 'Beitrag bearbeiten' : 'Beitrag erstellen'}</DialogTitle>
                  <DialogDescription>
                    Teile Neuigkeiten oder wichtige Hinweise mit Deiner Organisation oder allen Gästen.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleSavePost}>
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
                  <div className="space-y-2">
                    <Label htmlFor="post-attachment">Datei (optional)</Label>
                    <Input
                      id="post-attachment"
                      type="file"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const file = event.target.files?.[0] ?? null;
                        setAttachmentFile(file);
                        setRemoveAttachment(false);
                      }}
                    />
                    {attachmentFile && (
                      <p className="text-xs text-muted-foreground">Ausgewählt: {attachmentFile.name}</p>
                    )}
                    {newPost.attachment_url && !removeAttachment && (
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <a
                          href={newPost.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Aktuellen Anhang öffnen
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRemoveAttachment(true);
                            setNewPost((prev) => ({ ...prev, attachment_url: null }));
                          }}
                        >
                          Entfernen
                        </Button>
                      </div>
                    )}
                    {removeAttachment && (
                      <p className="text-xs text-destructive">Der bestehende Anhang wird entfernt.</p>
                    )}
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
                          <SelectItem value="ORG_ONLY">Organisationsintern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newPost.audience === 'ORG_ONLY' && (
                      <div className="space-y-2">
                        <Label>Ziel-Organisation</Label>
                        {canSelectTargetOrg ? (
                          <Select
                            value={newPost.target_organization_id ?? undefined}
                            onValueChange={(value) =>
                              setNewPost((prev) => ({ ...prev, target_organization_id: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Organisation wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableOrgs.map((org) => (
                                <SelectItem key={org.id} value={org.id}>
                                  {org.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Sichtbar nur für {profile?.organization?.name ?? 'Deine Organisation'}.
                          </p>
                        )}
                      </div>
                    )}
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
                      {creating ? 'Wird gespeichert...' : editingPostId ? 'Beitrag aktualisieren' : 'Beitrag veröffentlichen'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : isAuthenticated ? (
            <p className="text-sm text-muted-foreground">
              Nur Newsmanager können Beiträge erstellen oder bearbeiten.
            </p>
          ) : null}
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
              {isAuthenticated && (
                <Button onClick={() => openCreateDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ersten Beitrag erstellen
                </Button>
              )}
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
                        Von {post.created_by?.name ?? 'Unbekannt'} •{' '}
                        {formatDistanceToNow(new Date(post.created_at), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </CardDescription>
                    </div>
                    <Badge variant={post.audience === 'PUBLIC' ? 'default' : post.audience === 'INTERNAL' ? 'secondary' : 'outline'}>
                      {post.audience === 'PUBLIC'
                        ? 'Öffentlich'
                        : post.audience === 'INTERNAL'
                        ? 'Intern'
                        : 'Org-intern'}
                    </Badge>
                    {post.audience === 'ORG_ONLY' && post.target_organization?.name && (
                      <Badge variant="secondary">{post.target_organization.name}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {post.content}
                  </p>
                  {post.attachment_url && (
                    <a
                      href={post.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline mt-3"
                    >
                      <Paperclip className="h-4 w-4" />
                      Anhang öffnen
                    </a>
                  )}
                  {canManagePost(post) && (
                    <div className="flex items-center justify-end gap-2 mt-4">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(post)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Bearbeiten
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Beitrag löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Diese Aktion kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeletePost(post.id)}
                              disabled={deletingId === post.id}
                            >
                              {deletingId === post.id ? 'Löschen...' : 'Löschen'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
