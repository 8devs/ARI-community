import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, MapPin } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white">
      <div className="absolute inset-0">
        <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-indigo-500/40 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-purple-500/30 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-10 inline-flex rounded-full border border-white/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            Fehler 404
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Wir finden diesen Bereich nicht
          </h1>
          <p className="mt-4 text-base text-white/70 sm:text-lg">
            Die angeforderte Seite existiert nicht oder wurde verschoben. Über die folgenden
            Möglichkeiten gelangst Du zurück in die ARI Community.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 text-sm text-white/80 sm:flex-row">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
              <Home className="h-4 w-4 text-indigo-200" />
              <div className="text-left">
                <p className="font-medium text-white">App-Startseite</p>
                <p className="text-xs text-white/60">Dashboard mit allen Funktionen</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
              <MapPin className="h-4 w-4 text-indigo-200" />
              <div className="text-left">
                <p className="font-medium text-white">Zuletzt besuchte URL</p>
                <p className="text-xs text-white/60 truncate max-w-[220px]">
                  {location.pathname}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link to="/app">
                <Home className="mr-2 h-4 w-4" />
                zurück zur Übersicht
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full border border-white/20 text-white hover:bg-white/10 sm:w-auto"
              asChild
            >
              <Link to="/" className="flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Startseite öffnen
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
