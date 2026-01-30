import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, MessageCircle, Users, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Groups() {
  return (
    <Layout>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <Card className="border border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Community-Gruppen pausiert
            </CardTitle>
            <CardDescription>
              Die Gruppenfunktion ist vorübergehend deaktiviert, während wir an einem überarbeiteten
              Erlebnis arbeiten. Bestehende Chats und Mitgliedschaften bleiben erhalten, sind aber aktuell nicht erreichbar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Wir informieren euch, sobald die Gruppen wieder aktiv sind. Bis dahin könnt ihr weiterhin
              direkte Nachrichten senden oder im Who-is-Who stöbern, um Kolleg:innen zu erreichen.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/app">Zur Übersicht</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/changelog">Zum Changelog</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-dashed border-border/60 bg-muted/30">
          <CardHeader>
            <CardTitle>Alternative Kanäle</CardTitle>
            <CardDescription>Nutze direkte Nachrichten oder das Who-is-Who, um verbunden zu bleiben.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/90 p-4">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Nachrichten</p>
                  <p className="text-sm text-muted-foreground">Schreibe Kolleg:innen direkt an.</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/nachrichten">
                  Nachrichten öffnen
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/90 p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Who-is-Who</p>
                  <p className="text-sm text-muted-foreground">Profile & Kontaktinfos durchsuchen.</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/personen">
                  Profile anzeigen
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Link to="/app">
              <ArrowLeft className="h-4 w-4" />
              Zurück zur Übersicht
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
