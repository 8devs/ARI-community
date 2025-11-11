import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import People from "./pages/People";
import Pinnwand from "./pages/Pinnwand";
import QA from "./pages/QA";
import LunchRoulette from "./pages/LunchRoulette";
import AdminLunchRoulette from "./pages/AdminLunchRoulette";
import AdminOrganizations from "./pages/AdminOrganizations";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Coffee from "./pages/Coffee";

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
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Auth />} />
            <Route
              path="/"
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
              path="/admin/lunch-roulette"
              element={
                <ProtectedRoute>
                  <AdminLunchRoulette />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/organisationen"
              element={
                <ProtectedRoute>
                  <AdminOrganizations />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
