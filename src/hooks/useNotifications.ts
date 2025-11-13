import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type NotificationRow = Tables<"notifications">;

interface UseNotificationsOptions {
  enablePush?: boolean;
  limit?: number;
}

export function useNotifications(profileId?: string | null, options?: UseNotificationsOptions) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const limit = options?.limit ?? 50;

  const fetchNotifications = useCallback(async () => {
    if (!profileId) {
      setItems([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error loading notifications", error);
      toast.error("Benachrichtigungen konnten nicht geladen werden");
    } else {
      setItems(data);
    }

    setLoading(false);
  }, [profileId, limit]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!profileId) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", profileId);

      if (error) {
        console.error("Error updating notification", error);
        toast.error("Benachrichtigung konnte nicht aktualisiert werden");
        return;
      }

      setItems((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, read_at: new Date().toISOString() } : notification,
        ),
      );
    },
    [profileId],
  );

  const maybeShowNativeNotification = useCallback(
    (notification: NotificationRow) => {
      if (!options?.enablePush) return;
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      if (document.visibilityState === "visible") return;

      const dynamicIcon =
        document.querySelector('link[rel="icon"][data-dynamic-favicon="true"]') as HTMLLinkElement | null;
      new Notification(notification.title, {
        body: notification.body,
        tag: notification.id,
        icon: dynamicIcon?.href ?? undefined,
        data: notification.url,
      });
    },
    [options?.enablePush],
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${profileId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const notification = payload.new as NotificationRow;
            setItems((prev) => [notification, ...prev].slice(0, limit));
            maybeShowNativeNotification(notification);
          } else if (payload.eventType === "UPDATE") {
            const next = payload.new as NotificationRow;
            setItems((prev) => prev.map((item) => (item.id === next.id ? next : item)));
          } else if (payload.eventType === "DELETE") {
            const removed = payload.old as NotificationRow;
            setItems((prev) => prev.filter((item) => item.id !== removed.id));
          }
        },
      );

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, maybeShowNativeNotification, limit]);

  useEffect(() => {
    if (!profileId) return;
    const interval = setInterval(() => {
      void fetchNotifications(false);
    }, 60000);
    return () => clearInterval(interval);
  }, [profileId, fetchNotifications]);

  const unreadCount = useMemo(
    () => items.filter((notification) => !notification.read_at).length,
    [items],
  );

  return {
    items,
    loading,
    unreadCount,
    markAsRead,
    refresh: fetchNotifications,
  };
}
