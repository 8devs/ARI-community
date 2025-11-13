import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Users, 
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
  DoorClosed,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useTheme } from 'next-themes';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import defaultBrandLogo from '@/assets/ari-logo.png';

interface LayoutProps {
  children: ReactNode;
}

const BRAND_STORAGE_KEY = 'ari-brand-logo';

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { profile } = useCurrentProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = Boolean(user);
  const canAccessAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN';
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(BRAND_STORAGE_KEY);
  });
  const [pendingJoinRequests, setPendingJoinRequests] = useState<number>(0);
  const notifications = useNotifications(profile?.id, {
    enablePush: profile?.pref_push_notifications,
  });

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

  const AdminLinkContent = () => (
    <>
      <Shield className="h-4 w-4 mr-2" />
      Admin
      {pendingBadgeValue && (
        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
          {pendingBadgeValue}
        </span>
      )}
    </>
  );

  const navItems = useMemo(() => {
    if (isAuthenticated) {
      return [
        { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/pinnwand', label: 'Pinnwand', icon: Newspaper },
        { to: '/personen', label: 'Personen', icon: Users },
        { to: '/organisationen', label: 'Organisationen', icon: Building2 },
        { to: '/events', label: 'Events', icon: CalendarDays },
        { to: '/qa', label: 'Q&A', icon: MessageSquare },
        { to: '/nachrichten', label: 'Nachrichten', icon: MessageCircle },
        { to: '/kaffee', label: 'Kaffee', icon: Coffee },
        { to: '/raeume', label: 'Räume', icon: DoorClosed },
        { to: '/lunch-roulette', label: 'Lunch', icon: Utensils },
      ];
    }
    return [
      { to: '/', label: 'Start', icon: LayoutDashboard },
      { to: '/pinnwand', label: 'Pinnwand', icon: Newspaper },
      { to: '/organisationen', label: 'Organisationen', icon: Building2 },
      { to: '/events', label: 'Events', icon: CalendarDays },
    ];
  }, [isAuthenticated]);

  useEffect(() => {
    setThemeReady(true);
  }, []);

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
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'app_branding')
          .maybeSingle();
        if (error) {
          if (error.code === '42501') {
            return;
          }
          console.error('Error loading branding', error);
          return;
        }
        if (!ignore) {
          const value = (data?.value ?? null) as { logo_url?: string | null } | null;
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

    window.addEventListener('app-branding-updated', handleBrandingUpdate);

    return () => {
      ignore = true;
      window.removeEventListener('app-branding-updated', handleBrandingUpdate);
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
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchPending = async () => {
      let query = supabase
        .from('join_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      if (profile?.role === 'ORG_ADMIN') {
        if (!profile.organization_id) {
          setPendingJoinRequests(0);
          return;
        }
        query = query.eq('organization_id', profile.organization_id);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Error loading join requests count', error);
        return;
      }
      if (!cancelled) {
        setPendingJoinRequests(count ?? 0);
      }
    };

    fetchPending();

    channel = supabase
      .channel('join-requests-watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'join_requests' },
        () => {
          fetchPending();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [canAccessAdmin, profile?.role, profile?.organization_id]);

  const toggleTheme = () => {
    if (!themeReady) return;
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const isRouteActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navButtonClasses = 'transition-colors data-[active=true]:bg-muted data-[active=true]:text-foreground';
  const displayLogo = brandLogoUrl ?? defaultBrandLogo;


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-3" aria-label="Zur Startseite">
                <img
                  src={displayLogo}
                  alt="ARI Community"
                  className="h-10 w-auto object-contain"
                  loading="lazy"
                />
              </Link>

              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Menü öffnen</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 sm:w-80">
                  <div className="flex flex-col gap-4 mt-6">
                    {navItems.map(({ to, label, icon: Icon }) => (
                      <Button
                        key={to}
                        variant="ghost"
                        className={cn('justify-start', navButtonClasses)}
                        onClick={() => setMobileOpen(false)}
                        data-active={isRouteActive(to) ? 'true' : undefined}
                        asChild
                      >
                        <Link to={to}>
                          <Icon className="h-4 w-4 mr-2" />
                          {label}
                        </Link>
                      </Button>
                    ))}
                    {isAuthenticated && canAccessAdmin && (
                      <Button
                        variant="ghost"
                        className={cn('justify-start', navButtonClasses)}
                        onClick={() => setMobileOpen(false)}
                        data-active={isRouteActive('/admin') ? 'true' : undefined}
                        asChild
                      >
                        <Link to="/admin">
                          <AdminLinkContent />
                        </Link>
                      </Button>
                    )}
                    {themeReady && (
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                          toggleTheme();
                          setMobileOpen(false);
                        }}
                      >
                        {resolvedTheme === 'dark' ? (
                          <>
                            <Sun className="h-4 w-4 mr-2" />
                            Helles Design
                          </>
                        ) : (
                          <>
                            <Moon className="h-4 w-4 mr-2" />
                            Dunkles Design
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              <nav className="hidden md:flex items-center gap-1">
                {navItems.map(({ to, label, icon: Icon }) => (
                  <Button
                    key={to}
                    variant="ghost"
                    size="sm"
                    asChild
                    data-active={isRouteActive(to) ? 'true' : undefined}
                    className={navButtonClasses}
                  >
                    <Link to={to}>
                      <Icon className="h-4 w-4 mr-2" />
                      {label}
                    </Link>
                  </Button>
                ))}
                {isAuthenticated && canAccessAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    data-active={isRouteActive('/admin') ? 'true' : undefined}
                    className={navButtonClasses}
                  >
                    <Link to="/admin">
                      <AdminLinkContent />
                    </Link>
                  </Button>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  {themeReady && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleTheme}
                      aria-label="Theme wechseln"
                    >
                      {resolvedTheme === 'dark' ? (
                        <Sun className="h-[1.2rem] w-[1.2rem]" />
                      ) : (
                        <Moon className="h-[1.2rem] w-[1.2rem]" />
                      )}
                    </Button>
                  )}

                  <NotificationsMenu
                    unread={notifications.unreadCount}
                    notifications={notifications.items}
                    onMarkAsRead={notifications.markAsRead}
                    loading={notifications.loading}
                    onOpenNotifications={notifications.refresh}
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
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-8">{children}</main>

      <footer className="mt-auto border-t border-border bg-card/60">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <a
              href="https://aiddevs.com/impressum/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary transition-colors"
            >
              Impressum
            </a>
          </div>
          <p>Made with ❤️ in Worms by 8devs GmbH</p>
        </div>
      </footer>
    </div>
  );
}
