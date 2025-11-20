import { useEffect, useMemo, useRef, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageSquare, Plus, Shield, Users, Lock, Clock, Menu } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

interface GroupMemberDetail {
  user_id: string;
  role: "MEMBER" | "ADMIN";
  created_at: string;
  profile?: {
    id: string;
    name: string | null;
    position: string | null;
    avatar_url: string | null;
    organization?: {
      name: string | null;
    } | null;
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
  const [memberSearch, setMemberSearch] = useState("");
  const [activeDetailTab, setActiveDetailTab] = useState<"chat" | "members">("chat");
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);

  const groupChatRef = useRef<HTMLDivElement | null>(null);

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
  const activeGroupId = activeGroup?.id ?? null;

  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    setActiveDetailTab("chat");
    setMemberSearch("");
  }, [activeGroupId]);

  const groupMembersQuery = useQuery({
    queryKey: ["group-members", activeGroupId],
    enabled: Boolean(activeGroupId),
    queryFn: async () => {
      if (!activeGroupId) return [] as GroupMemberDetail[];
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          user_id,
          role,
          created_at,
          profile:profiles (
            id,
            name,
            position,
            avatar_url,
            organization:organizations!profiles_organization_id_fkey ( name )
          )
        `)
        .eq("group_id", activeGroupId)
        .order("role", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GroupMemberDetail[];
    },
  });

  const selectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setMessageInput("");
  };

  const isMember = (groupId: string | null) => {
    if (!groupId) return false;
    return membershipMap.has(groupId);
  };

  const renderGroupList = (onItemSelected?: () => void) => (
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
            onClick={() => {
              selectGroup(group.id);
              onItemSelected?.();
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{group.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{group.description}</p>
              </div>
              <Badge variant={group.visibility === 'PUBLIC' ? 'secondary' : 'outline'}>
                {group.visibility === 'PUBLIC' ? 'Offen' : 'Privat'}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleJoinGroup(group);
                  }}
                >
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
  );

  const isAdmin = (groupId: string | null) => {
    if (!groupId) return false;
    return membershipMap.get(groupId)?.role === "ADMIN";
  };

  const activeGroupMembers = groupMembersQuery.data ?? [];
  const adminCount = useMemo(
    () => activeGroupMembers.filter((member) => member.role === "ADMIN").length,
    [activeGroupMembers],
  );
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return activeGroupMembers;
    const term = memberSearch.trim().toLowerCase();
    return activeGroupMembers.filter((member) => {
      const haystack = `${member.profile?.name ?? ""} ${member.profile?.position ?? ""} ${
        member.profile?.organization?.name ?? ""
      }`.toLowerCase();
      return haystack.includes(term);
    });
  }, [activeGroupMembers, memberSearch]);
  const memberCount = activeGroupMembers.length || activeGroup?.member_count || 0;
  const lastMessage = useMemo(() => {
    const items = messagesQuery.data ?? [];
    if (!items.length) return null;
    return items[items.length - 1];
  }, [messagesQuery.data]);

  useEffect(() => {
    if (!groupChatRef.current) return;
    groupChatRef.current.scrollTo({ top: groupChatRef.current.scrollHeight, behavior: "smooth" });
  }, [messagesQuery.data]);
  const groupHighlights = useMemo(() => {
    if (!activeGroup) return [];
    const createdDate = format(new Date(activeGroup.created_at), "dd.MM.yyyy", { locale: de });
    const createdRelative = formatDistanceToNow(new Date(activeGroup.created_at), { addSuffix: true, locale: de });
    const lastActivity = lastMessage
      ? formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: true, locale: de })
      : "Noch keine Nachrichten";
    const lastAuthor = lastMessage?.sender?.name ?? "Mitglied";
    return [
      {
        label: "Mitglieder",
        value: memberCount,
        helper: adminCount > 0 ? `${adminCount} ${adminCount === 1 ? "Admin" : "Admins"} aktiv` : "Noch keine Admins",
        icon: Users,
      },
      {
        label: "Letzte Aktivität",
        value: lastActivity,
        helper: lastMessage ? `von ${lastAuthor}` : "Starte die Unterhaltung",
        icon: MessageSquare,
      },
      {
        label: "Gegründet",
        value: createdDate,
        helper: createdRelative,
        icon: Clock,
      },
    ];
  }, [activeGroup, adminCount, lastMessage, memberCount]);
  const canManageMembers = Boolean(activeGroupId && isAdmin(activeGroupId));

  const handleChangeMemberRole = async (userId: string, nextRole: "ADMIN" | "MEMBER") => {
    if (!activeGroupId || !canManageMembers) return;
    const targetMember = activeGroupMembers.find((member) => member.user_id === userId);
    if (targetMember?.role === "ADMIN" && nextRole === "MEMBER" && adminCount <= 1) {
      toast.error("Mindestens ein Admin muss bleiben.");
      return;
    }
    setMemberActionId(userId);
    const { error } = await supabase
      .from("group_members")
      .update({ role: nextRole })
      .eq("group_id", activeGroupId)
      .eq("user_id", userId);
    setMemberActionId(null);
    if (error) {
      console.error("update group member role failed", error);
      toast.error("Rolle konnte nicht aktualisiert werden");
      return;
    }
    toast.success(nextRole === "ADMIN" ? "Mitglied ist jetzt Admin" : "Rolle aktualisiert");
    queryClient.invalidateQueries({ queryKey: ["group-members", activeGroupId] });
    queryClient.invalidateQueries({ queryKey: ["group-memberships", profile?.id] });
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeGroupId || !canManageMembers) return;
    if (userId === profile?.id) {
      toast.info("Nutze den Button 'Verlassen', um Dich selbst zu entfernen.");
      return;
    }
    const targetMember = activeGroupMembers.find((member) => member.user_id === userId);
    if (targetMember?.role === "ADMIN" && adminCount <= 1) {
      toast.error("Mindestens ein Admin muss bleiben.");
      return;
    }
    setMemberActionId(userId);
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", activeGroupId)
      .eq("user_id", userId);
    setMemberActionId(null);
    if (error) {
      console.error("remove group member failed", error);
      toast.error("Mitglied konnte nicht entfernt werden");
      return;
    }
    toast.success("Mitglied entfernt");
    queryClient.invalidateQueries({ queryKey: ["group-members", activeGroupId] });
    queryClient.invalidateQueries({ queryKey: ["group-memberships", profile?.id] });
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
    queryClient.invalidateQueries({ queryKey: ["group-members", group.id] });
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
    queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
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

    setGroupForm({ name: "", description: "" });
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
    queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
  };

  return (
    <Layout>
      <Sheet open={groupSheetOpen} onOpenChange={setGroupSheetOpen}>
        <SheetContent side="left" className="flex w-full flex-col overflow-hidden border-r p-0 sm:max-w-md">
          <div className="border-b px-6 py-4">
            <SheetHeader className="text-left">
              <SheetTitle>Gruppen entdecken</SheetTitle>
              <SheetDescription>Wähle eine Gruppe aus oder starte eine neue Unterhaltung.</SheetDescription>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
            <div className="space-y-4">
              <Input
                placeholder="Suchen..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <ScrollArea className="h-[65vh] pr-2">
                {renderGroupList(() => setGroupSheetOpen(false))}
              </ScrollArea>
            </div>
          </div>
        </SheetContent>
      </Sheet>
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto lg:hidden"
              onClick={() => setGroupSheetOpen(true)}
            >
              <Menu className="mr-2 h-4 w-4" />
              Gruppen wählen
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <Card className="h-fit hidden lg:block">
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
                {renderGroupList()}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="flex min-h-[70vh] flex-col">
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
                <CardContent className="flex h-full flex-col gap-4 overflow-hidden">
                  {groupHighlights.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {groupHighlights.map((highlight) => {
                        const Icon = highlight.icon;
                        return (
                          <div
                            key={highlight.label}
                            className="rounded-2xl border border-border/70 bg-muted/30 p-4 shadow-sm"
                          >
                            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                              <span className="font-semibold">{highlight.label}</span>
                              <Icon className="h-4 w-4" />
                            </div>
                            <p className="mt-2 text-2xl font-bold text-foreground">{highlight.value}</p>
                            <p className="text-xs text-muted-foreground">{highlight.helper}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Tabs
                    value={activeDetailTab}
                    onValueChange={(value) => setActiveDetailTab(value as "chat" | "members")}
                    className="flex h-full flex-col"
                  >
                    <TabsList className="mb-4 flex w-full flex-wrap gap-2 bg-transparent p-0">
                      <TabsTrigger
                        value="chat"
                        className="flex-1 min-w-[140px] rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                      >
                        Unterhaltung
                      </TabsTrigger>
                      <TabsTrigger
                        value="members"
                        className="flex-1 min-w-[140px] rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                      >
                        Mitglieder
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="chat" className="flex-1">
                      <div className="flex h-full flex-col">
                        <div
                          ref={groupChatRef}
                          className="flex-1 overflow-y-auto rounded-xl border bg-muted/40 p-4 pb-12 min-h-[260px] max-h-[60vh]"
                        >
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
                                      'max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm',
                                      message.sender_id === profile?.id
                                        ? 'bg-primary text-primary-foreground'
                                        : 'border bg-card',
                                    )}
                                  >
                                    <p className="mb-1 text-xs font-semibold">
                                      {message.sender?.name ?? 'Mitglied'}
                                    </p>
                                    <p>{message.body}</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: de })}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
                              <MessageSquare className="mb-2 h-8 w-8" />
                              Noch keine Nachrichten.
                            </div>
                          )}
                        </div>
                        {isMember(activeGroup.id) ? (
                          <div className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm supports-[backdrop-filter]:backdrop-blur">
                            <Textarea
                              placeholder="Nachricht schreiben..."
                              value={messageInput}
                              onChange={(event) => setMessageInput(event.target.value)}
                              rows={3}
                              className="resize-none"
                            />
                            <div className="flex justify-end">
                              <Button onClick={handleSendMessage} disabled={!messageInput.trim() || sendingMessage}>
                                {sendingMessage ? 'Senden...' : 'Senden'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-4 rounded-2xl border border-dashed bg-card/40 p-4 text-sm text-muted-foreground">
                            Tritt der Gruppe bei, um Nachrichten auszutauschen.
                          </p>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="members" className="flex-1">
                      <div className="flex h-full flex-col gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">Mitgliederübersicht</p>
                            <p className="text-xs text-muted-foreground">
                              {memberCount} Mitglieder · {adminCount} Admin{adminCount === 1 ? '' : 's'}
                            </p>
                          </div>
                          <Input
                            value={memberSearch}
                            onChange={(event) => setMemberSearch(event.target.value)}
                            placeholder="Mitglieder durchsuchen..."
                            className="sm:max-w-xs"
                          />
                        </div>
                        {groupMembersQuery.isLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Mitglieder werden geladen...
                          </div>
                        ) : filteredMembers.length ? (
                          <div className="space-y-3">
                            {filteredMembers.map((member) => {
                              const initials = (member.profile?.name ?? 'Mitglied')
                                .split(' ')
                                .map((part) => part.charAt(0))
                                .filter(Boolean)
                                .join('')
                                .slice(0, 2)
                                .toUpperCase();
                              const metaLine =
                                [member.profile?.position, member.profile?.organization?.name]
                                  .filter(Boolean)
                                  .join(" · ") || 'Keine Angaben';
                              const isProcessing = memberActionId === member.user_id;
                              return (
                                <div
                                  key={member.user_id}
                                  className="flex flex-col gap-4 rounded-2xl border bg-card/60 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                      <AvatarFallback>{initials}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-semibold leading-tight">
                                        {member.profile?.name ?? 'Unbekanntes Mitglied'}
                                      </p>
                                      <p className="text-xs text-muted-foreground">{metaLine}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-2 text-xs text-muted-foreground md:text-right">
                                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                      <Badge variant={member.role === 'ADMIN' ? 'secondary' : 'outline'}>
                                        {member.role === 'ADMIN' ? 'Admin' : 'Mitglied'}
                                      </Badge>
                                      <span>
                                        seit{" "}
                                        {formatDistanceToNow(new Date(member.created_at), { addSuffix: true, locale: de })}
                                      </span>
                                    </div>
                                    {canManageMembers && member.user_id !== profile?.id && (
                                      <div className="flex flex-wrap items-center justify-end gap-2">
                                        {member.role === 'ADMIN' ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleChangeMemberRole(member.user_id, "MEMBER")}
                                            disabled={isProcessing || adminCount <= 1}
                                          >
                                            {isProcessing ? 'Aktualisiere...' : 'Admin entfernen'}
                                          </Button>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleChangeMemberRole(member.user_id, "ADMIN")}
                                            disabled={isProcessing}
                                          >
                                            {isProcessing ? 'Aktualisiere...' : 'Zum Admin machen'}
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleRemoveMember(member.user_id)}
                                          disabled={isProcessing}
                                        >
                                          {isProcessing ? 'Wird entfernt...' : 'Entfernen'}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            <Users className="mb-2 h-6 w-6" />
                            Keine Mitglieder gefunden.
                          </div>
                        )}
                        {canManageMembers && adminCount <= 1 && (
                          <p className="text-xs text-amber-600">
                            Mindestens ein Admin muss aktiv bleiben, um Mitglieder zu verwalten.
                          </p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
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
