import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { Building2, MapPin, Phone, Mail, Users, Globe } from 'lucide-react';

type Organization = Tables<'organizations'> & {
  member_count: number;
};

export default function Organizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_organizations_with_counts');
      if (error) throw error;
      setOrganizations((data as Organization[]) || []);
    } catch (error: any) {
      console.error('Error loading organizations', error);
      toast.error('Organisationen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Organisationen</h1>
          <p className="text-lg text-muted-foreground">
            Überblick über alle Firmen, Standorte und Ansprechpartner.
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Organisationen werden geladen...
            </CardContent>
          </Card>
        ) : organizations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Noch keine Organisationen angelegt.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {organizations.map((org) => (
              <Card
                key={org.id}
                className="flex flex-col cursor-pointer transition hover:shadow-lg focus-visible:ring-2"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/personen?organization=${org.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/personen?organization=${org.id}`);
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center gap-4">
                  <Avatar className="h-14 w-14 rounded-lg">
                    {org.logo_url ? (
                      <AvatarImage
                        src={org.logo_url}
                        alt={org.name}
                        className="object-contain rounded-lg bg-white p-1"
                      />
                    ) : (
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-6 w-6" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <CardTitle>{org.name}</CardTitle>
                    <CardDescription>{org.member_count} Mitarbeitende</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-1" />
                      <span>{org.location_text || 'Kein Standort hinterlegt'}</span>
                    </p>
                    {org.contact_name && (
                      <p className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{org.contact_name}</span>
                      </p>
                    )}
                    {org.contact_email && (
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <a href={`mailto:${org.contact_email}`} className="hover:text-primary truncate">
                          {org.contact_email}
                        </a>
                      </p>
                    )}
                    {org.contact_phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${org.contact_phone}`} className="hover:text-primary">
                          {org.contact_phone}
                        </a>
                      </p>
                    )}
                    {org.website_url && (
                      <p className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <a
                          href={org.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Webseite öffnen
                        </a>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
