import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useTheme } from 'next-themes';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationsMenu } from '@/components/NotificationsMenu';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { profile } = useCurrentProfile();
  const navigate = useNavigate();
  const isAuthenticated = Boolean(user);
  const canAccessAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN';
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);
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

  const toggleTheme = () => {
    if (!themeReady) return;
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
                <Building2 className="h-6 w-6" />
                ARI Community
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
                        className="justify-start"
                        onClick={() => setMobileOpen(false)}
                        asChild
                      >
                        <Link to={to}>
                          <Icon className="h-4 w-4 mr-2" />
                          {label}
                        </Link>
                      </Button>
                    ))}
                    {isAuthenticated && canAccessAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setMobileOpen(false)}
                          asChild
                        >
                          <Link to="/admin">
                            <Shield className="h-4 w-4 mr-2" />
                            Admin
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setMobileOpen(false)}
                          asChild
                        >
                          <Link to="/admin/lunch-roulette">
                            <Utensils className="h-4 w-4 mr-2" />
                            Lunch Roulette Admin
                          </Link>
                        </Button>
                      </>
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
                  <Button key={to} variant="ghost" size="sm" asChild>
                    <Link to={to}>
                      <Icon className="h-4 w-4 mr-2" />
                      {label}
                    </Link>
                  </Button>
                ))}
                {isAuthenticated && canAccessAdmin && (
                  <>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/admin">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/admin/lunch-roulette">
                        <Utensils className="h-4 w-4 mr-2" />
                        Lunch Admin
                      </Link>
                    </Button>
                  </>
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
