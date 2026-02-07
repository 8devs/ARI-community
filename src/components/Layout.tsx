import { ReactNode, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Newspaper,
  MessageSquare,
  Building2,
  Utensils,
  LogOut,
  Shield,
  IdCard,
  Coffee,
  Menu,
  CalendarDays,
  MessageCircle,
  Moon,
  Sun,
  Laptop,
  DoorClosed,
  Bell,
  Users,
  UtensilsCrossed,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useTheme } from 'next-themes';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import defaultBrandLogo from '@/assets/ari-logo.png';
import { APP_VERSION } from '@/version';

interface LayoutProps {
  children: ReactNode;
}

const BRAND_STORAGE_KEY = 'ari-brand-logo';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

type ThemeChoice = 'light' | 'dark' | 'system';

const THEME_OPTIONS: { value: ThemeChoice; label: string; description: string; icon: LucideIcon }[] = [
  {
    value: 'system',
    label: 'Automatisch',
    description: 'Richtet sich nach Deiner Systemeinstellung',
    icon: Laptop,
  },
  {
    value: 'light',
    label: 'Hell',
    description: 'Optimiert für helle Umgebungen',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dunkel',
    description: 'Setzt auf minimale Lichtemission',
    icon: Moon,
  },
];

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { profile } = useCurrentProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = Boolean(user);
  const canAccessAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(BRAND_STORAGE_KEY);
  });
  const [pendingJoinRequests, setPendingJoinRequests] = useState<number>(0);
  const notifications = useNotifications(profile?.id, {
    enablePush: profile?.pref_push_notifications,
    limit: 20,
  });
  const displayLogo = brandLogoUrl ?? defaultBrandLogo;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = () => {
    if (!user?.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

  const formatPendingCount = () => {
    if (pendingJoinRequests > 99) return '99+';
    if (pendingJoinRequests > 0) return String(pendingJoinRequests);
    return null;
  };

  const pendingBadgeValue = formatPendingCount();

  const navItems = useMemo<NavItem[]>(() => {
    if (!isAuthenticated) {
      return [
        { to: '/', label: 'Start', icon: LayoutDashboard },
        { to: '/pinnwand', label: 'Pinnwand', icon: Newspaper },
        { to: '/events', label: 'Events', icon: CalendarDays },
        { to: '/organisationen', label: 'Organisationen', icon: Building2 },
      ];
    }
    const items: NavItem[] = [
      { to: '/app', label: 'Übersicht', icon: LayoutDashboard },
      { to: '/personen', label: 'Who-is-Who', icon: Users },
      { to: '/nachrichten', label: 'Nachrichten', icon: MessageCircle },
      { to: '/pinnwand', label: 'Pinnwand', icon: Newspaper },
      { to: '/events', label: 'Events', icon: CalendarDays },
      { to: '/organisationen', label: 'Organisationen', icon: Building2 },
      { to: '/raeume', label: 'Räume', icon: DoorClosed },
      { to: '/qa', label: 'Q&A', icon: MessageSquare },
      { to: '/lunch-roulette', label: 'Lunch', icon: Utensils },
      { to: '/mittagessen', label: 'Lunch Orte', icon: UtensilsCrossed },
      { to: '/kaffee', label: 'Getränke-Abrechnung', icon: Coffee },
      { to: '/empfang', label: 'Empfang & Aufgaben', icon: ClipboardList },
    ];
    if (canAccessAdmin) {
      items.push({ to: '/admin', label: 'Administration', icon: Shield });
    }
    return items;
  }, [isAuthenticated, canAccessAdmin]);

  useEffect(() => {
    setThemeReady(true);
  }, []);

  const currentThemeValue = (theme as ThemeChoice | undefined) ?? 'system';
  const currentThemeLabel =
    THEME_OPTIONS.find((option) => option.value === currentThemeValue)?.label ?? 'Automatisch';

  const ThemeMenu = ({
    variant = 'sidebar',
    className,
    onSelection,
  }: {
    variant?: 'sidebar' | 'icon';
    className?: string;
    onSelection?: () => void;
  }) => {
    if (!themeReady) return null;

    const icon =
      resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === 'icon' ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Erscheinungsbild wählen"
              className={className}
            >
              {resolvedTheme === 'dark' ? (
                <Moon className="h-[1.1rem] w-[1.1rem]" />
              ) : (
                <Sun className="h-[1.1rem] w-[1.1rem]" />
              )}
            </Button>
          ) : (
            <Button variant="outline" className={cn('justify-between', className)}>
              <span className="flex items-center gap-2">
                {icon}
                <span>Erscheinungsbild</span>
              </span>
              <span className="text-xs font-semibold text-muted-foreground">{currentThemeLabel}</span>
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={variant === 'icon' ? 'end' : 'start'}
          sideOffset={8}
          className="w-64"
        >
          <DropdownMenuLabel>Darstellung</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={currentThemeValue}
            onValueChange={(value) => {
              setTheme(value as ThemeChoice);
              onSelection?.();
            }}
          >
            {THEME_OPTIONS.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="flex items-start gap-3 py-2"
              >
                <option.icon className="mt-0.5 h-4 w-4" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const cacheBrandLogo = (logoUrl: string | null) => {
    if (typeof window === 'undefined') return;
    if (logoUrl) {
      window.sessionStorage.setItem(BRAND_STORAGE_KEY, logoUrl);
    } else {
      window.sessionStorage.removeItem(BRAND_STORAGE_KEY);
    }
  };

  useEffect(() => {
    cacheBrandLogo(brandLogoUrl);
  }, [brandLogoUrl]);

  useEffect(() => {
    let ignore = false;

    const fetchBranding = async () => {
      try {
        const res = await api.query<{ data: any }>('/api/settings/app_branding');
        if (!ignore) {
          const value = (res.data ?? null) as { logo_url?: string | null } | null;
          setBrandLogoUrl(value?.logo_url ?? null);
        }
      } catch (error) {
        console.error('Unexpected branding error', error);
      }
    };

    fetchBranding();

    const handleBrandingUpdate = (event: CustomEvent<{ logoUrl?: string | null }>) => {
      setBrandLogoUrl(event.detail?.logoUrl ?? null);
    };

    window.addEventListener('app-branding-updated', handleBrandingUpdate as EventListener);

    return () => {
      ignore = true;
      window.removeEventListener('app-branding-updated', handleBrandingUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const rels = ['icon', 'shortcut icon'];
    const getMimeType = (url: string) => (url.toLowerCase().includes('.svg') ? 'image/svg+xml' : 'image/png');

    if (brandLogoUrl) {
      rels.forEach((rel) => {
        let link = document.querySelector(`link[rel="${rel}"][data-dynamic-favicon="true"]`) as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.rel = rel;
          link.setAttribute('data-dynamic-favicon', 'true');
          document.head.appendChild(link);
        }
        link.href = brandLogoUrl;
        link.type = getMimeType(brandLogoUrl);
      });
    } else {
      rels.forEach((rel) => {
        const link = document.querySelector(`link[rel="${rel}"][data-dynamic-favicon="true"]`);
        link?.parentNode?.removeChild(link);
      });
    }
  }, [brandLogoUrl]);

  useEffect(() => {
    if (!canAccessAdmin) {
      setPendingJoinRequests(0);
      return;
    }

    let cancelled = false;

    const fetchPending = async () => {
      try {
        const res = await api.query<{ data: any[] }>('/api/join-requests');
        const pending = res.data.filter((r) => r.status === 'PENDING');
        if (!cancelled) {
          setPendingJoinRequests(pending.length);
        }
      } catch (error) {
        console.error('Error loading join requests count', error);
      }
    };

    fetchPending();

    // Socket.io realtime for join request changes
    const socket = connectSocket();
    const handleJoinRequestChanged = () => {
      fetchPending();
    };
    socket.on('join-request:changed', handleJoinRequestChanged);

    return () => {
      cancelled = true;
      socket.off('join-request:changed', handleJoinRequestChanged);
    };
  }, [canAccessAdmin, profile?.role, profile?.organization_id]);

  const isRouteActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navButtonClasses =
    'w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/60 dark:hover:bg-accent/30 data-[active=true]:bg-primary/15 data-[active=true]:text-primary-foreground';

  const renderNav = (onNavigate?: () => void) => (
    <div className="space-y-1">
      {navItems.map(({ to, label, icon: Icon }) => (
        <Button
          key={to}
          variant="ghost"
          size="sm"
          className={cn(navButtonClasses)}
          data-active={isRouteActive(to) ? 'true' : undefined}
          asChild
          onClick={() => onNavigate?.()}
        >
          <Link to={to} className="flex w-full items-center gap-3">
            <Icon className="h-4 w-4" />
            <span className="flex-1 truncate">{label}</span>
            {to === '/admin' && pendingBadgeValue && (
              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
                {pendingBadgeValue}
              </span>
            )}
          </Link>
        </Button>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-72 flex-col border-r border-border/60 bg-card/70 backdrop-blur lg:flex">
        <Link to="/" className="flex items-center gap-3 border-b border-border/60 px-6 py-5" aria-label="Zur Startseite">
          <img src={displayLogo} alt="ARI Community" className="h-10 w-auto object-contain" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">ARI Community</p>
            <p className="text-xs text-muted-foreground">
              {profile?.organization?.name ?? 'Gemeinsam vernetzt'}
            </p>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto px-4 py-6">{renderNav()}</div>
        <div className="space-y-3 border-t border-border/60 px-4 py-6">
          <ThemeMenu className="w-full" />
        </div>
      </aside>

      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="shrink-0 sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Navigation öffnen</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 sm:w-80">
                  <div className="mt-4 flex items-center gap-3 border-b border-border/60 pb-4">
                    <img src={displayLogo} alt="ARI Community" className="h-10 w-auto object-contain" />
                    <div>
                      <p className="text-sm font-semibold">ARI Community</p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.organization?.name ?? 'Gemeinsam vernetzt'}
                      </p>
                    </div>
                  </div>
                  <div className="py-6">{renderNav(() => setSidebarOpen(false))}</div>
                  <ThemeMenu className="w-full" onSelection={() => setSidebarOpen(false)} />
                </SheetContent>
              </Sheet>
              <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="Zur Startseite">
                <img src={displayLogo} alt="ARI Community" className="h-9 w-auto object-contain" />
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <ThemeMenu variant="icon" className="lg:hidden" />
              {isAuthenticated ? (
                <>

                  <NotificationsMenu
                    unread={notifications.unreadCount}
                    notifications={notifications.items}
                    onMarkAsRead={notifications.markAsRead}
                    loading={notifications.loading}
                    onOpenNotifications={notifications.refresh}
                    onMarkAllAsRead={notifications.markAllAsRead}
                    onNavigate={(url) => {
                      if (url) {
                        navigate(url);
                      }
                    }}
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                        <Avatar className="h-10 w-10">
                          {profile?.avatar_url && (
                            <AvatarImage src={profile.avatar_url} alt={profile.name ?? 'Profilbild'} />
                          )}
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials()}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate('/benachrichtigungen')}>
                        <Bell className="mr-2 h-4 w-4" />
                        Benachrichtigungen
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/profil')}>
                        <IdCard className="mr-2 h-4 w-4" />
                        Profil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Abmelden
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button asChild>
                  <Link to="/login">Anmelden</Link>
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
        </main>

        <footer className="shrink-0 border-t border-border bg-card/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-10 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="https://aiddevs.com/impressum/"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-primary"
              >
                Impressum
              </a>
              <Link to="/changelog" className="transition-colors hover:text-primary">
                Changelog
              </Link>
              <span className="text-xs">Version {APP_VERSION}</span>
            </div>
            <div className="flex flex-col gap-1 text-right md:text-left">
              <p>Made with ❤️ in Worms by 8devs GmbH</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
