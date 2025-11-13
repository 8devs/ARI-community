import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Newspaper, MessageSquare, Calendar, ArrowRight, Utensils, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

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

  useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Willkommen in der ARI Community! 👋</h1>
          <p className="text-lg text-muted-foreground">
            Vernetze Dich mit Kollegen aus allen Unternehmen am Adenauerring
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Who-is-Who</CardTitle>
              <CardDescription>
                Lerne Deine Kollegen kennen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" asChild className="w-full justify-between">
                <Link to="/personen">
                  Personen ansehen
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Newspaper className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Pinnwand</CardTitle>
              <CardDescription>
                Aktuelle News & Ankündigungen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" asChild className="w-full justify-between">
                <Link to="/pinnwand">
                  Zur Pinnwand
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Q&A</CardTitle>
              <CardDescription>
                Fragen stellen & helfen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" asChild className="w-full justify-between">
                <Link to="/qa">
                  Fragen ansehen
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Calendar className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Events</CardTitle>
              <CardDescription>
                Kommende Veranstaltungen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" asChild className="w-full justify-between">
                <Link to="/events">
                  Events ansehen
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-accent" />
              Lunch Roulette 🎲
            </CardTitle>
            <CardDescription>
              Lerne neue Kollegen beim gemeinsamen Mittagessen kennen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Melde Dich für die wöchentliche Runde an und werde zufällig mit Kollegen aus anderen Unternehmen gepaart!
            </p>
            <Button variant="default" asChild className="w-full">
              <Link to="/lunch-roulette">
                Zur Anmeldung
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

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
    </Layout>
  );
}
