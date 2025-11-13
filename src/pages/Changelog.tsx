import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { changelogEntries } from "@/data/changelog";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION, APP_RELEASE_DATE } from "@/version";

export default function Changelog() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Aktuelle Version</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold">v{APP_VERSION}</h1>
            <Badge variant="secondary">veröffentlicht am {APP_RELEASE_DATE}</Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Der Verlauf zeigt, welche Features wann in die ARI Community eingeflossen sind. Bitte ergänze jede Änderung hier,
            damit alle Nutzer:innen den Fortschritt nachvollziehen können.
          </p>
        </div>

        <div className="space-y-4">
          {changelogEntries.map((entry) => (
            <Card key={entry.version} className="border border-border/70">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle>Version {entry.version}</CardTitle>
                  <Badge variant="outline">{entry.date}</Badge>
                </div>
                <CardDescription>Highlights dieser Veröffentlichung</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {entry.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {entry.details && entry.details.length > 0 && (
                  <div className="rounded-xl bg-muted/60 p-4">
                    <p className="text-sm font-semibold mb-2">Weitere Details</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {entry.details.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
