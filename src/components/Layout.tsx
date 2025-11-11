import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  LayoutDashboard, 
  Newspaper, 
  Calendar, 
  MessageSquare, 
  ShoppingBag,
  Building2,
  BarChart3,
  ThumbsUp,
  Coffee,
  Utensils,
  Heart,
  LogOut,
  Bell
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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
  const navigate = useNavigate();

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
                  <Link to="/qa">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Q&A
                  </Link>
                </Button>
              </nav>
            </div>

            <div className="flex items-center gap-2">
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
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
