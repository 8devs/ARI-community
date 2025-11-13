import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Plus, Shield, Users, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CommunityGroup {
  id: string;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  created_at: string;
  member_count: number;
}

interface GroupMembership {
  group_id: string;
  role: "MEMBER" | "ADMIN";
}

interface GroupMessage {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  sender?: {
    name: string | null;
  } | null;
}

export default function Groups() {
  const { profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
  });
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["community-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_groups")
        .select("id, name, description, visibility, created_at, group_members(count)")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((group: any) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        visibility: group.visibility,
        created_at: group.created_at,
        member_count: group.group_members?.[0]?.count ?? 0,
      })) as CommunityGroup[];
    },
  });

  const membershipsQuery = useQuery({
    queryKey: ["group-memberships", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      if (!profile?.id) return [] as GroupMembership[];
      const { data, error } = await supabase.rpc("list_group_memberships", { _user_id: profile.id });
      if (error) throw error;
      return (data ?? []) as GroupMembership[];
    },
  });

  const membershipMap = useMemo(() => {
    const map = new Map<string, GroupMembership>();
    membershipsQuery.data?.forEach((member) => map.set(member.group_id, member));
    return map;
  }, [membershipsQuery.data]);

  const isSelectedMember = selectedGroupId ? membershipMap.has(selectedGroupId) : false;

  const messagesQuery = useQuery({
    queryKey: ["group-messages", selectedGroupId],
    enabled: Boolean(selectedGroupId && isSelectedMember),
    queryFn: async () => {
      if (!selectedGroupId) return [] as GroupMessage[];
      const { data, error } = await supabase
        .from("group_messages")
        .select("id, body, created_at, sender_id, sender:profiles(name)")
        .eq("group_id", selectedGroupId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GroupMessage[];
    },
  });

  const groups = useMemo(() => {
    if (!groupsQuery.data) return [] as CommunityGroup[];
    const term = search.toLowerCase();
    if (!term) return groupsQuery.data;
    return groupsQuery.data.filter((group) =>
      `${group.name} ${group.description ?? ""}`.toLowerCase().includes(term),
    );
  }, [groupsQuery.data, search]);

  const activeGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;

  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const selectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setMessageInput("");
  };

  const isMember = (groupId: string | null) => {
    if (!groupId) return false;
    return membershipMap.has(groupId);
  };

  const isAdmin = (groupId: string | null) => {
    if (!groupId) return false;
    return membershipMap.get(groupId)?.role === "ADMIN";
  };

  const handleJoinGroup = async (group: CommunityGroup) => {
    if (!profile?.id) return;
    const { error } = await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: profile.id,
    });
    if (error) {
      toast.error('Gruppe konnte nicht beigetreten werden');
      console.error('join group failed', error);
      return;
    }
    toast.success(`Du bist der Gruppe ${group.name} beigetreten`);
    queryClient.invalidateQueries({ queryKey: ["group-memberships", profile.id] });
    queryClient.invalidateQueries({ queryKey: ["community-groups"] });
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!profile?.id) return;
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", profile.id);
    if (error) {
      toast.error('Austritt fehlgeschlagen');
      console.error('leave group failed', error);
      return;
    }
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }
    toast.success('Du hast die Gruppe verlassen');
    queryClient.invalidateQueries({ queryKey: ["group-memberships", profile.id] });
    queryClient.invalidateQueries({ queryKey: ["community-groups"] });
  };

  const handleSendMessage = async () => {
    if (!selectedGroupId || !profile?.id) return;
    const trimmed = messageInput.trim();
    if (!trimmed) return;
    setSendingMessage(true);
    const { error } = await supabase.from("group_messages").insert({
      group_id: selectedGroupId,
      sender_id: profile.id,
      body: trimmed,
    });
    setSendingMessage(false);
    if (error) {
      console.error('message send failed', error);
      toast.error('Nachricht konnte nicht gesendet werden');
      return;
    }
    setMessageInput("");
    queryClient.invalidateQueries({ queryKey: ["group-messages", selectedGroupId] });
  };  

  const handleCreateGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.id) return;
    if (!groupForm.name.trim()) {
      toast.error('Bitte gib einen Namen ein');
      return;
    }
    setCreatingGroup(true);
    const { data, error } = await supabase
      .from("community_groups")
      .insert({
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || null,
        visibility: 'PUBLIC',
        created_by_id: profile.id,
      })
      .select('id')
      .single();
    setCreatingGroup(false);

    if (error) {
      console.error('create group failed', error);
      toast.error('Gruppe konnte nicht erstellt werden');
      return;
    }

    setGroupForm({ name: "", description: "", visibility: "PUBLIC" });
    setCreateDialogOpen(false);
    toast.success('Gruppe erstellt');
    queryClient.invalidateQueries({ queryKey: ["community-groups"] });
    queryClient.invalidateQueries({ queryKey: ["group-memberships", profile.id] });
    if (data?.id) {
      setSelectedGroupId(data.id);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!groupId) return;
    setDeletingGroupId(groupId);
    const { error } = await supabase.from('community_groups').delete().eq('id', groupId);
    setDeletingGroupId(null);
    if (error) {
      toast.error('Gruppe konnte nicht gelöscht werden');
      console.error('delete group failed', error);
      return;
    }
    toast.success('Gruppe gelöscht');
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }
    queryClient.invalidateQueries({ queryKey: ['community-groups'] });
    queryClient.invalidateQueries({ queryKey: ['group-memberships', profile?.id] });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Community Gruppen</h1>
            <p className="text-muted-foreground">Organisationsübergreifend Interessen teilen und verabreden.</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Gruppe erstellen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Gruppe</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreateGroup}>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="group-name">
                    Name
                  </label>
                  <Input
                    id="group-name"
                    value={groupForm.name}
                    onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="z. B. Laufgruppe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="group-description">
                    Beschreibung
                  </label>
                  <Textarea
                    id="group-description"
                    value={groupForm.description}
                    onChange={(event) => setGroupForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Worum geht es in der Gruppe?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sichtbarkeit</label>
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    Gruppen sind derzeit immer <span className="font-semibold text-foreground">öffentlich</span> und
                    für alle sichtbar. Zugang kann über Mitgliedschaft gesteuert werden.
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creatingGroup}>
                    {creatingGroup ? 'Wird erstellt...' : 'Gruppe anlegen'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Alle Gruppen</CardTitle>
              <CardDescription>Trete offenen Communities bei oder starte eine neue.</CardDescription>
              <Input
                placeholder="Suchen..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[65vh] pr-2">
                <div className="space-y-3">
                  {groupsQuery.isLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Gruppen werden geladen...
                    </div>
                  )}
                  {!groupsQuery.isLoading && groups.length === 0 && (
                    <p className="text-sm text-muted-foreground">Keine Gruppen gefunden.</p>
                  )}
                  {groups.map((group) => {
                    const member = membershipMap.get(group.id);
                    const isSelected = (selectedGroupId ?? activeGroup?.id) === group.id;
                    return (
                      <div
                        key={group.id}
                        className={cn(
                          "rounded-xl border p-4 transition cursor-pointer",
                          isSelected ? "border-primary bg-primary/5" : "border-border/60",
                        )}
                        onClick={() => selectGroup(group.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{group.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{group.description}</p>
                          </div>
                          <Badge variant={group.visibility === 'PUBLIC' ? 'secondary' : 'outline'}>
                            {group.visibility === 'PUBLIC' ? 'Offen' : 'Privat'}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> {group.member_count} Mitglieder
                          </span>
                          {member ? (
                            <span className="flex items-center gap-1">
                              <Shield className="h-3.5 w-3.5" /> {member.role === 'ADMIN' ? 'Admin' : 'Mitglied'}
                            </span>
                          ) : group.visibility === 'PRIVATE' ? (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Lock className="h-3.5 w-3.5" /> Privat
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" onClick={(event) => {
                              event.stopPropagation();
                              void handleJoinGroup(group);
                            }}>
                              Beitreten
                            </Button>
                          )}
                        </div>
                        {member && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleLeaveGroup(group.id);
                            }}
                          >
                            Verlassen
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="min-h-[70vh]">
            {activeGroup ? (
              <>
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {activeGroup.name}
                      <Badge variant={activeGroup.visibility === 'PUBLIC' ? 'secondary' : 'outline'}>
                        {activeGroup.visibility === 'PUBLIC' ? 'Offen' : 'Privat'}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{activeGroup.description || 'Noch keine Beschreibung'}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isAdmin(activeGroup.id) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            Gruppe löschen
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Gruppe wirklich löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Alle Nachrichten und Mitgliederzuordnungen gehen verloren. Dieser Vorgang kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteGroup(activeGroup.id)}
                              disabled={deletingGroupId === activeGroup.id}
                            >
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {isMember(activeGroup.id) ? (
                      <Button variant="outline" size="sm" onClick={() => handleLeaveGroup(activeGroup.id)}>
                        Verlassen
                      </Button>
                    ) : activeGroup.visibility === 'PUBLIC' ? (
                      <Button size="sm" onClick={() => handleJoinGroup(activeGroup)}>
                        Beitreten
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex h-full flex-col">
                  <div className="flex-1 overflow-y-auto rounded-xl border bg-muted/40 p-4">
                    {messagesQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Unterhaltung lädt...
                      </div>
                    ) : messagesQuery.data && messagesQuery.data.length > 0 ? (
                      <div className="space-y-4">
                        {messagesQuery.data.map((message) => (
                          <div
                            key={message.id}
                            className={cn(
                              "flex flex-col",
                              message.sender_id === profile?.id ? 'items-end' : 'items-start',
                            )}
                          >
                            <div
                              className={cn(
                                'rounded-2xl px-4 py-2 text-sm shadow-sm max-w-[85%]',
                                message.sender_id === profile?.id ? 'bg-primary text-primary-foreground' : 'bg-card border',
                              )}
                            >
                              <p className="font-semibold text-xs mb-1">
                                {message.sender?.name ?? 'Mitglied'}
                              </p>
                              <p>{message.body}</p>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: de })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mb-2" />
                        Noch keine Nachrichten.
                      </div>
                    )}
                  </div>
                  {isMember(activeGroup.id) ? (
                    <div className="mt-4 space-y-2">
                      <Textarea
                        placeholder="Nachricht schreiben..."
                        value={messageInput}
                        onChange={(event) => setMessageInput(event.target.value)}
                        rows={3}
                      />
                      <div className="flex justify-end">
                        <Button onClick={handleSendMessage} disabled={!messageInput.trim() || sendingMessage}>
                          {sendingMessage ? 'Senden...' : 'Senden'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Tritt der Gruppe bei, um Nachrichten auszutauschen.
                    </p>
                  )}
                </CardContent>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <MessageSquare className="h-10 w-10" />
                Wähle links eine Gruppe aus oder erstelle eine neue.
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
