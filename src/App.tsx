import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import People from "./pages/People";
import Organizations from "./pages/Organizations";
import Pinnwand from "./pages/Pinnwand";
import QA from "./pages/QA";
import LunchRoulette from "./pages/LunchRoulette";
import AdminLunchRoulette from "./pages/AdminLunchRoulette";
import AdminSettings from "./pages/AdminSettings";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Coffee from "./pages/Coffee";
import ResetPassword from "./pages/ResetPassword";
import Events from "./pages/Events";
import Messages from "./pages/Messages";
import Rooms from "./pages/Rooms";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Lädt...</p>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <AuthProvider>
            <Routes>
            <Route path="/login" element={<Auth />} />
            <Route path="/" element={<Index />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/personen"
              element={
                <ProtectedRoute>
                  <People />
                </ProtectedRoute>
              }
            />
            <Route path="/pinnwand" element={<Pinnwand />} />
            <Route path="/organisationen" element={<Organizations />} />
            <Route path="/organisation" element={<Organizations />} />
            <Route path="/events" element={<Events />} />
            <Route path="/passwort/neu" element={<ResetPassword />} />
            <Route
              path="/qa"
              element={
                <ProtectedRoute>
                  <QA />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kaffee"
              element={
                <ProtectedRoute>
                  <Coffee />
                </ProtectedRoute>
              }
            />
            <Route
              path="/raeume"
              element={
                <ProtectedRoute>
                  <Rooms />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lunch-roulette"
              element={
                <ProtectedRoute>
                  <LunchRoulette />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profil"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nachrichten"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/lunch-roulette"
              element={
                <ProtectedRoute>
                  <AdminLunchRoulette />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </HashRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
