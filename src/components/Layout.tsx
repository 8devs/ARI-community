import { ReactNode, useMemo, useState } from 'react';
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
  Bell,
  Shield,
  IdCard,
  Coffee,
  Menu,
  Newspaper,
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

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { profile } = useCurrentProfile();
  const navigate = useNavigate();
  const isAuthenticated = Boolean(user);
  const [mobileOpen, setMobileOpen] = useState(false);

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
        { to: '/qa', label: 'Q&A', icon: MessageSquare },
        { to: '/kaffee', label: 'Kaffee', icon: Coffee },
        { to: '/lunch-roulette', label: 'Lunch', icon: Utensils },
      ];
    }
    return [
      { to: '/', label: 'Start', icon: LayoutDashboard },
      { to: '/pinnwand', label: 'Pinnwand', icon: Newspaper },
      { to: '/organisationen', label: 'Organisationen', icon: Building2 },
    ];
  }, [isAuthenticated]);


  return (
    <div className="min-h-screen bg-background">
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
                    {isAuthenticated && profile && profile.role !== 'MEMBER' && (
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
                {isAuthenticated && profile && profile.role !== 'MEMBER' && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin">
                      <Shield className="h-4 w-4 mr-2" />
                      Admin
                    </Link>
                  </Button>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <Button variant="ghost" size="icon">
                    <Bell className="h-5 w-5" />
                  </Button>
                  
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

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
