import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

interface NotificationsMenuProps {
  unread: number;
  notifications: NotificationRow[];
  loading: boolean;
  onMarkAsRead: (id: string) => void | Promise<void>;
  onOpenNotifications?: () => void;
  onNavigate?: (url: string | null) => void;
  onMarkAllAsRead?: () => void | Promise<void>;
}

export function NotificationsMenu({
  unread,
  notifications,
  loading,
  onMarkAsRead,
  onOpenNotifications,
  onNavigate,
  onMarkAllAsRead,
}: NotificationsMenuProps) {
  const handleNavigate = (notification: NotificationRow) => {
    if (!notification.read_at) {
      void onMarkAsRead(notification.id);
    }
    if (notification.url) {
      onNavigate?.(notification.url);
    }
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          onOpenNotifications?.();
          void onMarkAllAsRead?.();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="px-4 py-3">Benachrichtigungen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <DropdownMenuItem className="text-muted-foreground text-sm">Lädt...</DropdownMenuItem>
          ) : notifications.length === 0 ? (
            <DropdownMenuItem className="text-muted-foreground text-sm">Keine Benachrichtigungen</DropdownMenuItem>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex flex-col items-start gap-1 py-3 cursor-pointer"
                onSelect={(event) => {
                  event.preventDefault();
                  handleNavigate(notification);
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <p className="font-medium">{notification.title}</p>
                  {!notification.read_at && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onMarkAsRead(notification.id);
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{notification.body}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: de })}
                </p>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/benachrichtigungen" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Benachrichtigungscenter öffnen
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
