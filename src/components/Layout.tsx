import { ReactNode } from 'react';
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
  Coffee
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

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { profile } = useCurrentProfile();
  const navigate = useNavigate();
  const isAuthenticated = Boolean(user);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = () => {
    if (!user?.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

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
              
              <nav className="hidden md:flex items-center gap-1">
                {isAuthenticated ? (
                  <>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/">
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Dashboard
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/pinnwand">
                        <Newspaper className="h-4 w-4 mr-2" />
                        Pinnwand
                      </Link>
                    </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/personen">
                    <Users className="h-4 w-4 mr-2" />
                    Personen
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/organisationen">
                    <Building2 className="h-4 w-4 mr-2" />
                    Organisationen
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/qa">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Q&A
                  </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/kaffee">
                        <Coffee className="h-4 w-4 mr-2" />
                        Kaffee
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/lunch-roulette">
                        <Utensils className="h-4 w-4 mr-2" />
                        Lunch
                      </Link>
                    </Button>
                {profile && profile.role !== 'MEMBER' && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin">
                      <Shield className="h-4 w-4 mr-2" />
                      Admin
                    </Link>
                  </Button>
                )}
                    {profile?.role === 'SUPER_ADMIN' && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/admin/organisationen">
                          <Building2 className="h-4 w-4 mr-2" />
                          Organisationen
                        </Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/pinnwand">
                      <Newspaper className="h-4 w-4 mr-2" />
                      Pinnwand
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
