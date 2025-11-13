import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Newspaper,
  MessageSquare,
  Calendar,
  ArrowRight,
  Utensils,
  Loader2,
  Bell,
  UserPlus,
  MessageCircle,
  Building2,
  CheckCircle2,
  Circle,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type ActivityItem = {
  id: string;
  type: 'POST' | 'QUESTION' | 'EVENT';
  title: string;
  description: string;
  created_at: string;
  url: string;
};

export default function Dashboard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const { profile } = useCurrentProfile();
  const [groupJoined, setGroupJoined] = useState(false);
  const [lunchParticipating, setLunchParticipating] = useState(false);
  const [onboardingDialogOpen, setOnboardingDialogOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ari-onboarding-dismissed') === 'true';
  });
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ari-onboarding-seen') === 'true';
  });
  const [showVersionCard, setShowVersionCard] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('ari-version-card-dismissed') !== 'true';
  });

  useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem('ari-brand-logo');
    if (stored) {
      setBrandLogo(stored);
    }

    const handleBrandingUpdate = (event: Event) => {
      const custom = event as CustomEvent<{ logoUrl?: string | null }>;
      setBrandLogo(custom.detail?.logoUrl ?? null);
    };

    window.addEventListener('app-branding-updated', handleBrandingUpdate as EventListener);
    return () => {
      window.removeEventListener('app-branding-updated', handleBrandingUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    setOrgLogo(profile?.organization?.logo_url ?? brandLogo ?? null);
  }, [profile?.organization?.logo_url, brandLogo]);

  useEffect(() => {
    if (!profile?.id) return;
    let ignore = false;
    const fetchGroups = async () => {
      const { count, error } = await supabase
        .from('group_members')
        .select('group_id', { count: 'exact', head: true })
        .eq('user_id', profile.id);
      if (!ignore && !error) {
        setGroupJoined((count ?? 0) > 0);
      }
    };

    const fetchLunch = async () => {
      const { count, error } = await supabase
        .from('match_participations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id);
      if (!ignore && !error) {
        setLunchParticipating((count ?? 0) > 0);
      }
    };

    void fetchGroups();
    void fetchLunch();
    return () => {
      ignore = true;
    };
  }, [profile?.id]);

  const loadActivities = async () => {
    setActivityLoading(true);
    try {
      const [postsRes, questionsRes, eventsRes] = await Promise.all([
        supabase
          .from('info_posts')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('questions')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('events')
          .select('id, title, starts_at')
          .order('starts_at', { ascending: false })
          .limit(5),
      ]);

      const next: ActivityItem[] = [];

      postsRes.data?.forEach((post) =>
        next.push({
          id: `post-${post.id}`,
          type: 'POST',
          title: post.title,
          description: 'Neuer Pinnwandeintrag',
          created_at: post.created_at,
          url: '/pinnwand',
        }),
      );

      questionsRes.data?.forEach((question) =>
        next.push({
          id: `question-${question.id}`,
          type: 'QUESTION',
          title: question.title,
          description: 'Neue Frage im Q&A',
          created_at: question.created_at,
          url: `/qa?question=${question.id}`,
        }),
      );

      eventsRes.data?.forEach((event) =>
        next.push({
          id: `event-${event.id}`,
          type: 'EVENT',
          title: event.title,
          description: 'Veranstaltung geplant',
          created_at: event.starts_at,
          url: '/events',
        }),
      );

      next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(next.slice(0, 5));
    } catch (error) {
      console.error('Error loading activities', error);
    } finally {
      setActivityLoading(false);
    }
  };

  const profileComplete = Boolean(profile?.bio && profile?.skills_text && profile?.avatar_url);
  const notificationsReady = Boolean(profile?.pref_email_notifications || profile?.pref_push_notifications);

  const onboardingSteps = useMemo(
    () => [
      {
        id: 'profile',
        title: 'Profil ergänzen',
        description: 'Foto, Skills und Kontaktdaten aktualisieren.',
        link: '/profil',
        completed: profileComplete,
      },
      {
        id: 'groups',
        title: 'Gruppe beitreten',
        description: 'Community-Gruppe finden und mitreden.',
        link: '/gruppen',
        completed: groupJoined,
      },
      {
        id: 'notifications',
        title: 'Benachrichtigungen prüfen',
        description: 'Push- oder E-Mail-Alerts aktivieren.',
        link: '/benachrichtigungen',
        completed: notificationsReady,
      },
      {
        id: 'lunch',
        title: 'Lunch Roulette ausprobieren',
        description: 'Für die nächste Runde anmelden.',
        link: '/lunch-roulette',
        completed: lunchParticipating,
      },
    ],
    [profileComplete, groupJoined, notificationsReady, lunchParticipating],
  );

  const completedSteps = onboardingSteps.filter((step) => step.completed).length;
  const onboardingCompleted = completedSteps === onboardingSteps.length;

  useEffect(() => {
    if (!onboardingCompleted && !onboardingDismissed && !hasSeenOnboarding) {
      setOnboardingDialogOpen(true);
      setHasSeenOnboarding(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ari-onboarding-seen', 'true');
      }
    }
  }, [onboardingCompleted, onboardingDismissed, hasSeenOnboarding]);

  const dismissOnboarding = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ari-onboarding-dismissed', 'true');
    }
    setOnboardingDismissed(true);
    setOnboardingDialogOpen(false);
  };

  const resetOnboarding = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ari-onboarding-dismissed');
      localStorage.removeItem('ari-onboarding-seen');
    }
    setOnboardingDismissed(false);
    setHasSeenOnboarding(false);
    setOnboardingDialogOpen(true);
  };

  const dismissVersionCard = () => {
    setShowVersionCard(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ari-version-card-dismissed', 'true');
    }
  };

  const quickActions = [
    {
      title: 'Pinnwand',
      description: 'News & Updates',
      icon: Newspaper,
      to: '/pinnwand',
    },
    {
      title: 'Events',
      description: 'Workshops & Treffen',
      icon: Calendar,
      to: '/events',
    },
    {
      title: 'Gruppen',
      description: 'Gemeinsam aktiv werden',
      icon: UserPlus,
      to: '/gruppen',
    },
    {
      title: 'Nachrichten',
      description: 'Direkter Austausch',
      icon: MessageCircle,
      to: '/nachrichten',
    },
    {
      title: 'Q&A',
      description: 'Fragen stellen & helfen',
      icon: MessageSquare,
      to: '/qa',
    },
    {
      title: 'Organisation & Personen',
      description: 'Teams & Ansprechpartner',
      icon: Building2,
      to: '/organisationen',
    },
    {
      title: 'Benachrichtigungen',
      description: 'Center & Historie',
      icon: Bell,
      to: '/benachrichtigungen',
    },
    {
      title: 'Lunch Roulette',
      description: 'Neue Kontakte beim Essen',
      icon: Utensils,
      to: '/lunch-roulette',
    },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <Card className="border-primary/20">
            <CardHeader className="space-y-1">
              <CardTitle className="text-3xl font-bold">
                {profile?.name ? `Hallo ${profile.name.split(' ')[0]} 👋` : 'Willkommen in der ARI Community 👋'}
              </CardTitle>
              <CardDescription>
                {profile?.organization?.name
                  ? `Deine Organisation: ${profile.organization.name}`
                  : 'Verbinde Dich mit Teams am Adenauerring'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orgLogo && (
                <div className="flex justify-center">
                  <img src={orgLogo} alt="Organisationslogo" className="h-12 w-auto object-contain" />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Rolle</p>
                  <p className="text-base font-semibold capitalize">{profile?.role?.toLowerCase() ?? 'Mitglied'}</p>
                </div>
                <div className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Organisation</p>
                  <p className="text-base font-semibold">
                    {profile?.organization?.name ?? 'Noch nicht zugeordnet'}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Benachrichtigungen</p>
                  <p className="text-base font-semibold">
                    {notificationsReady ? 'Aktiv' : 'Noch offen'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/profil">Profil bearbeiten</Link>
                </Button>
                {!onboardingCompleted && (
                  <Button variant="outline" onClick={() => setOnboardingDialogOpen(true)}>
                    Onboarding starten
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {showVersionCard && (
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      Neu in Version 0.4
                    </CardTitle>
                    <CardDescription>Gruppen, Benachrichtigungscenter & mehr.</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={dismissVersionCard} aria-label="Hinweis ausblenden">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>★ Trete Community-Gruppen bei und chatte organisationsübergreifend.</p>
                <p>★ Lass Dich per Push/E-Mail über neue Pinnwand- & Q&A-Beiträge informieren.</p>
                <Button variant="ghost" size="sm" asChild className="w-full justify-between">
                  <Link to="/changelog">
                    Zum Changelog
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {!hasSeenOnboarding && !onboardingCompleted && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Onboarding für neue Mitarbeitende</CardTitle>
                <CardDescription>{completedSteps} von {onboardingSteps.length} Aufgaben erledigt</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:w-48">
                <Progress value={(completedSteps / onboardingSteps.length) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">Fortschritt</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {onboardingSteps.map((step) => (
                  <div key={step.id} className="flex flex-col gap-2 rounded-2xl border bg-white/30 p-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={cn(
                          'rounded-full border p-1',
                          step.completed ? 'border-emerald-500 text-emerald-500' : 'border-muted text-muted-foreground',
                        )}
                      >
                        {step.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium">{step.title}</p>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={step.link}>Los geht's</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Direkt starten</h2>
              <p className="text-muted-foreground">Wähle einen Bereich aus, um schnell loszulegen.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={resetOnboarding}>
              Onboarding anzeigen
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <Card key={action.title} className="hover:border-primary/50 transition">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <action.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{action.title}</CardTitle>
                  </div>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" asChild className="w-full justify-between">
                    <Link to={action.to}>
                      Öffnen
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Letzte Aktivitäten</CardTitle>
              <CardDescription>
                Was gibt es Neues in der Community?
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={loadActivities} disabled={activityLoading}>
              Aktualisieren
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {activityLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aktivitäten werden geladen...
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Aktivitäten gefunden. Schau später noch einmal vorbei.</p>
            ) : (
              activities.map((activity) => (
                <Link
                  key={activity.id}
                  to={activity.url}
                  className="flex items-start gap-4 rounded-lg border p-4 transition hover:bg-muted/60"
                >
                  <div className="mt-1">
                    {activity.type === 'POST' && <Newspaper className="h-5 w-5 text-primary" />}
                    {activity.type === 'QUESTION' && <MessageSquare className="h-5 w-5 text-primary" />}
                    {activity.type === 'EVENT' && <Calendar className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: de })}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={onboardingDialogOpen} onOpenChange={setOnboardingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Willkommen bei ARI</DialogTitle>
            <DialogDescription>
              Diese Schritte helfen Dir, innerhalb weniger Minuten startklar zu sein.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {onboardingSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-3">
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={dismissOnboarding}>
              Später
            </Button>
            <Button asChild>
              <Link to="/profil">Los geht's</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
