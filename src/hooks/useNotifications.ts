import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { toast } from "sonner";

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

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
    try {
      const res = await api.query<{ data: NotificationRow[] }>("/api/notifications", { limit: String(limit) });
      setItems(res.data);
    } catch (error) {
      console.error("Error loading notifications", error);
      toast.error("Benachrichtigungen konnten nicht geladen werden");
    }
    setLoading(false);
  }, [profileId, limit]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!profileId) return;
      try {
        await api.mutate(`/api/notifications/${notificationId}/read`, {}, "PATCH");
        setItems((prev) =>
          prev.map((notification) =>
            notification.id === notificationId ? { ...notification, read_at: new Date().toISOString() } : notification,
          ),
        );
      } catch (error) {
        console.error("Error updating notification", error);
        toast.error("Benachrichtigung konnte nicht aktualisiert werden");
      }
    },
    [profileId],
  );

  const markAllAsRead = useCallback(async () => {
    if (!profileId) return;
    const unreadCount = items.filter((item) => !item.read_at).length;
    if (unreadCount === 0) return;

    const now = new Date().toISOString();
    try {
      await api.mutate("/api/notifications/read-all", {});
      setItems((prev) =>
        prev.map((notification) => (notification.read_at ? notification : { ...notification, read_at: now })),
      );
    } catch (error) {
      console.error("Error marking notifications as read", error);
      toast.error("Benachrichtigungen konnten nicht aktualisiert werden");
    }
  }, [profileId, items]);

  const maybeShowNativeNotification = useCallback(
    (notification: NotificationRow) => {
      if (!options?.enablePush) return;
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      if (document.visibilityState === "visible") return;

      const dynamicIcon =
        document.querySelector('link[rel="icon"][data-dynamic-favicon="true"]') as HTMLLinkElement | null;
      new Notification(notification.title, {
        body: notification.body ?? undefined,
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

  // Socket.io realtime notifications
  useEffect(() => {
    if (!profileId) return;

    const socket = connectSocket();

    const handleNew = (notification: NotificationRow) => {
      setItems((prev) => [notification, ...prev].slice(0, limit));
      maybeShowNativeNotification(notification);
    };

    const handleUpdated = (notification: NotificationRow) => {
      setItems((prev) => prev.map((item) => (item.id === notification.id ? notification : item)));
    };

    socket.on("notification:new", handleNew);
    socket.on("notification:updated", handleUpdated);

    return () => {
      socket.off("notification:new", handleNew);
      socket.off("notification:updated", handleUpdated);
    };
  }, [profileId, maybeShowNativeNotification, limit]);

  // Polling fallback
  useEffect(() => {
    if (!profileId) return;
    const interval = setInterval(() => {
      void fetchNotifications();
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
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
