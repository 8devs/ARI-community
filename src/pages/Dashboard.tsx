import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Newspaper, MessageSquare, Calendar, ArrowRight, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
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
          <CardHeader>
            <CardTitle>Letzte Aktivitäten</CardTitle>
            <CardDescription>
              Was gibt es Neues in der Community?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-primary mt-2" />
              <div className="flex-1">
                <p className="text-sm font-medium">Willkommen in der ARI Community App!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Hier kannst Du Dich mit Kollegen vernetzen, Fragen stellen, Events organisieren und vieles mehr.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
