import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2, Check, Trash2, Clock, RefreshCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 25;

type NotificationRow = Tables<"notifications">;

type FilterValue = "all" | "unread" | "read";

export default function NotificationsCenter() {
  const { profile } = useCurrentProfile();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<FilterValue>("all");
  const notificationsLengthRef = useRef(0);
  const [clearing, setClearing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    notificationsLengthRef.current = notifications.length;
  }, [notifications.length]);

  const fetchNotifications = useCallback(
    async (append = false) => {
      if (!profile?.id) {
        setNotifications([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        setTotalCount(0);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const offset = append ? notificationsLengthRef.current : 0;
      const { data, error, count } = await supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error("Error loading notifications center", error);
        toast.error("Benachrichtigungen konnten nicht geladen werden");
      } else {
        const rows = data ?? [];
        setNotifications((prev) => (append ? [...prev, ...rows] : rows));
        const loadedTotal = append ? notificationsLengthRef.current + rows.length : rows.length;
        setTotalCount(count ?? loadedTotal);
        if (typeof count === "number") {
          setHasMore(loadedTotal < count);
        } else {
          setHasMore(rows.length === PAGE_SIZE);
        }
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [profile?.id],
  );

  useEffect(() => {
    void fetchNotifications(false);
  }, [fetchNotifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((notification) => !notification.read_at);
    }
    if (filter === "read") {
      return notifications.filter((notification) => Boolean(notification.read_at));
    }
    return notifications;
  }, [filter, notifications]);

  const handleMarkAsRead = async (notification: NotificationRow) => {
    if (!profile?.id || notification.read_at) return;
    setActionId(notification.id);
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notification.id)
      .eq("user_id", profile.id);

    if (error) {
      console.error("Error marking notification", error);
      toast.error("Benachrichtigung konnte nicht aktualisiert werden");
    } else {
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item)),
      );
    }

    setActionId(null);
  };

  const handleDelete = async (notificationId: string) => {
    if (!profile?.id) return;
    setActionId(notificationId);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", profile.id);

    if (error) {
      console.error("Error deleting notification", error);
      toast.error("Benachrichtigung konnte nicht gelöscht werden");
    } else {
      toast.success("Benachrichtigung gelöscht");
      await fetchNotifications(false);
    }

    setActionId(null);
  };

  const handleClearAll = async () => {
    if (!profile?.id) return;
    setClearing(true);
    const { error } = await supabase.from("notifications").delete().eq("user_id", profile.id);
    if (error) {
      console.error("Error clearing notifications", error);
      toast.error("Benachrichtigungen konnten nicht gelöscht werden");
    } else {
      toast.success("Alle Benachrichtigungen gelöscht");
      setNotifications([]);
      setHasMore(false);
      setTotalCount(0);
    }
    setClearing(false);
  };

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read_at).length, [notifications]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Benachrichtigungen</h1>
            <p className="text-muted-foreground">Verwalte Deine Benachrichtigungen, lösche alte Einträge und behalte die Historie im Blick.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fetchNotifications(false)} disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Aktualisieren
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={notifications.length === 0 || clearing}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Alle löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Alle Benachrichtigungen löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Die Historie wird komplett entfernt. Dieser Vorgang kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} disabled={clearing}>
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Insgesamt</CardDescription>
              <CardTitle className="text-3xl">{totalCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Alle gespeicherten Benachrichtigungen</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ungelesen</CardDescription>
              <CardTitle className="text-3xl">{unreadCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Nachrichten, die Deine Aufmerksamkeit brauchen</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Letzte Aktivität</CardDescription>
              <CardTitle className="text-xl">
                {notifications[0]
                  ? formatDistanceToNow(new Date(notifications[0].created_at), { addSuffix: true, locale: de })
                  : "Keine Einträge"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Zeitpunkt der jüngsten Benachrichtigung</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Historie</CardTitle>
              <CardDescription>Durchsuche und verwalte alle früheren Meldungen.</CardDescription>
            </div>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterValue)}>
              <TabsList className="flex w-full flex-wrap gap-2 bg-muted/60">
                <TabsTrigger value="all" className="flex-1">Alle</TabsTrigger>
                <TabsTrigger value="unread" className="flex-1">Ungelesen</TabsTrigger>
                <TabsTrigger value="read" className="flex-1">Gelesen</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Benachrichtigungen werden geladen...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
                <Clock className="h-6 w-6" />
                <p>Keine Benachrichtigungen im ausgewählten Filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "rounded-2xl border p-4 transition",
                      notification.read_at ? "bg-card" : "bg-primary/5 border-primary/30",
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{notification.title}</p>
                          <Badge variant={notification.read_at ? "secondary" : "default"}>
                            {notification.read_at ? "Gelesen" : "Neu"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.body}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: de })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {notification.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!notification.read_at) {
                                void handleMarkAsRead(notification);
                              }
                              if (notification.url.startsWith("http")) {
                                window.open(notification.url, "_blank", "noopener,noreferrer");
                              } else {
                                navigate(notification.url);
                              }
                            }}
                          >
                            Öffnen
                          </Button>
                        )}
                        {!notification.read_at && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleMarkAsRead(notification)}
                            disabled={actionId === notification.id}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Als gelesen markieren
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(notification.id)}
                          disabled={actionId === notification.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Löschen
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasMore && !loading && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => fetchNotifications(true)} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mehr laden
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
