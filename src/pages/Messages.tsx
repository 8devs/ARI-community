import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Send, Smile } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { sendEmailNotification } from "@/lib/notifications";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";

interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface Coworker {
  id: string;
  name: string;
  avatar_url: string | null;
  email: string;
  organization_id: string | null;
  pref_email_notifications?: boolean;
  organization?: { name: string | null } | null;
}

type ThreadSummary = {
  partner_id: string | null;
  last_message: string | null;
  last_sender_id: string | null;
  last_created_at: string | null;
  unread_count: number | null;
};

export default function Messages() {
  const { profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const coworkersQuery = useQuery({
    queryKey: ["coworkers", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      if (!profile?.id) return [];
      const res = await api.query<{ data: Coworker[] }>("/api/profiles");
      return res.data.filter((p) => p.id !== profile.id);
    },
  });

  const threadsQuery = useQuery({
    queryKey: ["message-threads", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      if (!profile?.id) return [];
      const res = await api.query<{ data: ThreadSummary[] }>("/api/messages/threads");
      return res.data;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", profile?.id, selectedPartnerId],
    enabled: Boolean(profile?.id && selectedPartnerId),
    queryFn: async () => {
      if (!profile?.id || !selectedPartnerId) return [];
      const res = await api.query<{ data: MessageRow[] }>(`/api/messages/${selectedPartnerId}`);
      return res.data;
    },
  });

  const selectedPartner = useMemo(() => {
    return coworkersQuery.data?.find((coworker) => coworker.id === selectedPartnerId) ?? null;
  }, [coworkersQuery.data, selectedPartnerId]);

  const threadLookup = useMemo(() => {
    const map = new Map<string, ThreadSummary>();
    threadsQuery.data?.forEach((thread) => {
      if (thread.partner_id) {
        map.set(thread.partner_id, thread);
      }
    });
    return map;
  }, [threadsQuery.data]);

  const filteredCoworkers = useMemo(() => {
    if (!coworkersQuery.data) return [];
    return coworkersQuery.data.filter((coworker) =>
      coworker.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [coworkersQuery.data, searchTerm]);

  useEffect(() => {
    if (selectedPartnerId || !threadsQuery.data?.length) return;
    const firstThread = threadsQuery.data.find((thread) => Boolean(thread.partner_id));
    if (firstThread?.partner_id) {
      setSelectedPartnerId(firstThread.partner_id);
    } else if (coworkersQuery.data?.length) {
      setSelectedPartnerId(coworkersQuery.data[0].id);
    }
  }, [selectedPartnerId, threadsQuery.data, coworkersQuery.data]);

  // Mark messages as read
  useEffect(() => {
    if (!profile?.id || !selectedPartnerId || !messagesQuery.data?.length) return;
    const unreadIds = messagesQuery.data
      .filter((message) => message.recipient_id === profile.id && !message.read_at)
      .map((message) => message.id);
    if (!unreadIds.length) return;

    api.mutate("/api/messages/read", { ids: unreadIds }, "PATCH")
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["message-threads", profile.id] });
      })
      .catch((error) => console.error("Error marking messages as read", error));
  }, [profile?.id, selectedPartnerId, messagesQuery.data, queryClient]);

  // Socket.io realtime for new messages
  useEffect(() => {
    if (!profile?.id) return;
    const socket = connectSocket();

    const handleNewMessage = (message: MessageRow) => {
      if (message.sender_id !== profile.id && message.recipient_id !== profile.id) return;
      queryClient.invalidateQueries({ queryKey: ["message-threads", profile.id] });
      if (
        selectedPartnerId &&
        (message.sender_id === selectedPartnerId || message.recipient_id === selectedPartnerId)
      ) {
        queryClient.invalidateQueries({ queryKey: ["messages", profile.id, selectedPartnerId] });
      }
    };

    socket.on("message:new", handleNewMessage);
    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [profile?.id, queryClient, selectedPartnerId]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messagesQuery.data]);

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id || !selectedPartnerId) {
      toast.error("Bitte wähle eine Person aus.");
      return;
    }
    const trimmed = messageText.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      await api.mutate("/api/messages", {
        recipient_id: selectedPartnerId,
        body: trimmed,
      });
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["messages", profile.id, selectedPartnerId] });
      queryClient.invalidateQueries({ queryKey: ["message-threads", profile.id] });

      if (selectedPartner?.pref_email_notifications && selectedPartner.email) {
        const appUrl = `${window.location.origin}/#/nachrichten`;
        const preview = trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
        void sendEmailNotification(
          selectedPartner.email,
          `Neue Nachricht aus der ARI Community`,
          `<p>Hallo ${selectedPartner.name},</p><p>${profile.name} hat Dir in der ARI Community eine Nachricht gesendet:</p><blockquote>${preview}</blockquote><p><a href="${appUrl}">Hier klicken</a>, um direkt zu antworten.</p>`,
        );
      }
    } catch (error) {
      console.error("Error sending message", error);
      toast.error("Nachricht konnte nicht gesendet werden");
    }
    setSending(false);
  };

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    setMessageText((prev) => `${prev}${emojiData.emoji}`);
  };

  return (
    <Layout>
      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Alle Mitarbeitenden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                className="pl-9"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-[50vh] lg:max-h-[70vh] overflow-y-auto pr-1">
              {coworkersQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kolleg:innen werden geladen...
                </div>
              )}
              {!coworkersQuery.isLoading && filteredCoworkers.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Treffer</p>
              )}
              {filteredCoworkers.map((coworker) => {
                const thread = coworker.id ? threadLookup.get(coworker.id) : undefined;
                const unread = thread?.unread_count ?? 0;
                return (
                  <button
                    key={coworker.id}
                    onClick={() => setSelectedPartnerId(coworker.id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left transition hover:bg-muted",
                      selectedPartnerId === coworker.id ? "border-primary bg-primary/5" : "border-transparent",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {coworker.avatar_url && <AvatarImage src={coworker.avatar_url} alt={coworker.name} />}
                        <AvatarFallback>{coworker.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">{coworker.name}</p>
                          {unread > 0 && <Badge variant="destructive">{unread}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {coworker.organization?.name ?? "Ohne Organisation"}
                        </p>
                        {thread?.last_message && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{thread.last_message}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[50vh] lg:min-h-[70vh]">
          <CardHeader>
            <CardTitle>
              {selectedPartner ? `Chat mit ${selectedPartner.name}` : "Bitte Kolleg:in auswählen"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4 pb-24">
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto rounded-xl border bg-muted/40 p-4 min-h-[280px] lg:min-h-[360px] max-h-[50vh] lg:max-h-[65vh]"
            >
              {!selectedPartner && (
                <p className="text-muted-foreground text-sm">
                  Wähle auf der linken Seite eine Person aus, um Nachrichten auszutauschen.
                </p>
              )}

              {selectedPartner && messagesQuery.isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Unterhaltung lädt...
                </div>
              )}

              {selectedPartner && !messagesQuery.isLoading && messagesQuery.data?.length === 0 && (
                <p className="text-muted-foreground text-sm">Ihr habt noch keine Nachrichten ausgetauscht.</p>
              )}

              <div className="space-y-4">
                {messagesQuery.data?.map((message) => {
                  const isOwn = message.sender_id === profile?.id;
                  return (
                    <div key={message.id} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2 text-sm shadow-sm",
                          isOwn ? "bg-primary text-primary-foreground" : "bg-card border",
                        )}
                      >
                        <p>{message.body}</p>
                      </div>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: de })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border bg-card/80 p-3 shadow-sm supports-[backdrop-filter]:backdrop-blur">
              <form onSubmit={handleSendMessage} className="space-y-3">
                <Textarea
                  placeholder={selectedPartner ? "Nachricht eingeben..." : "Bitte zuerst eine Person auswählen."}
                  value={messageText}
                  disabled={!selectedPartner || sending}
                  onChange={(event) => setMessageText(event.target.value)}
                  rows={3}
                  className="min-h-[120px] resize-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={!selectedPartner || sending}
                        aria-label="Emoji auswählen"
                      >
                        <Smile className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full max-w-[320px] border-0 p-0 shadow-lg" align="start">
                      <EmojiPicker
                        onEmojiClick={handleEmojiSelect}
                        theme={Theme.AUTO}
                        width="100%"
                        lazyLoadEmojis
                        previewConfig={{ showPreview: false }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button type="submit" disabled={!selectedPartner || sending || !messageText.trim()} className="ml-auto">
                    {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="mr-2 h-4 w-4" />
                    Nachricht senden
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
