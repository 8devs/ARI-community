import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Building2, MapPin, Users, Pencil, PlusCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';

type Organization = Tables<'organizations'>;
type ProfileRow = Tables<'profiles'> & {
  organization?: {
    name: string | null;
  } | null;
};

const emptyOrgForm = {
  name: '',
  logo_url: '',
  cost_center_code: '',
  location_text: '',
};

export default function AdminOrganizations() {
  const { profile } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState(emptyOrgForm);
  const [savingOrg, setSavingOrg] = useState(false);
  const [memberUpdates, setMemberUpdates] = useState<Record<string, boolean>>({});

  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!isSuperAdmin) return;
    Promise.all([loadOrganizations(), loadMembers()]).finally(() => setLoading(false));
  }, [isSuperAdmin]);

  const loadOrganizations = async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading organizations', error);
      toast.error('Organisationen konnten nicht geladen werden');
      return;
    }
    setOrganizations(data || []);
  };

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        organization:organizations(name)
      `)
      .order('name');

    if (error) {
      console.error('Error loading members', error);
      toast.error('Mitarbeitende konnten nicht geladen werden');
      return;
    }
    setMembers(data || []);
  };

  const openCreateDialog = () => {
    setEditingOrg(null);
    setOrgForm(emptyOrgForm);
    setOrgDialogOpen(true);
  };

  const openEditDialog = (org: Organization) => {
    setEditingOrg(org);
    setOrgForm({
      name: org.name,
      logo_url: org.logo_url ?? '',
      cost_center_code: org.cost_center_code ?? '',
      location_text: org.location_text ?? '',
    });
    setOrgDialogOpen(true);
  };

  const handleOrgInputChange = (field: keyof typeof orgForm, value: string) => {
    setOrgForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgForm.name.trim()) {
      toast.error('Bitte einen Namen angeben');
      return;
    }

    setSavingOrg(true);
    const payload = {
      name: orgForm.name.trim(),
      logo_url: orgForm.logo_url.trim() || null,
      cost_center_code: orgForm.cost_center_code.trim() || null,
      location_text: orgForm.location_text.trim(),
    };

    const query = editingOrg
      ? supabase.from('organizations').update(payload).eq('id', editingOrg.id)
      : supabase.from('organizations').insert(payload);

    const { error } = await query;
    if (error) {
      console.error('Error saving organization', error);
      toast.error('Organisation konnte nicht gespeichert werden');
    } else {
      toast.success(editingOrg ? 'Organisation aktualisiert' : 'Organisation erstellt');
      setOrgDialogOpen(false);
      setEditingOrg(null);
      setOrgForm(emptyOrgForm);
      loadOrganizations();
    }
    setSavingOrg(false);
  };

  const handleMemberOrgChange = async (memberId: string, newOrgId: string) => {
    setMemberUpdates((prev) => ({ ...prev, [memberId]: true }));
    const { error } = await supabase
      .from('profiles')
      .update({ organization_id: newOrgId })
      .eq('id', memberId);

    if (error) {
      console.error('Error updating member organization', error);
      toast.error('Mitglied konnte nicht verschoben werden');
    } else {
      toast.success('Mitglied verschoben');
      loadMembers();
      loadOrganizations();
    }
    setMemberUpdates((prev) => ({ ...prev, [memberId]: false }));
  };

  const totalMembersPerOrg = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((member) => {
      const orgId = member.organization_id;
      if (orgId) {
        counts[orgId] = (counts[orgId] || 0) + 1;
      }
    });
    return counts;
  }, [members]);

  if (!isSuperAdmin) {
    return (
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Zugriff verweigert</CardTitle>
            <CardDescription>
              Nur Super Admins können Organisationen verwalten.
            </CardDescription>
          </CardHeader>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold">Organisationen verwalten</h1>
            <p className="text-muted-foreground">
              Logos pflegen, Standorte dokumentieren und Mitarbeitende verschieben.
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Organisation anlegen
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organisationen</CardTitle>
            <CardDescription>
              Übersicht aller Organisationen inklusive Kostenstellen und Standorte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Lädt...</p>
            ) : organizations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Organisationen hinterlegt.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {organizations.map((org) => (
                  <Card key={org.id} className="border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="space-y-1">
                        <CardTitle>{org.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {org.cost_center_code
                            ? `Kostenstelle: ${org.cost_center_code}`
                            : 'Keine Kostenstelle hinterlegt'}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {totalMembersPerOrg[org.id] || 0} Mitglieder
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        {org.logo_url ? (
                          <img
                            src={org.logo_url}
                            alt={`${org.name} Logo`}
                            className="h-12 w-12 rounded-md border object-contain bg-white"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-md border flex items-center justify-center text-muted-foreground">
                            <Building2 className="h-5 w-5" />
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1 font-medium">
                            <MapPin className="h-4 w-4" />
                            Standort
                          </div>
                          <p className="line-clamp-2">{org.location_text || 'Nicht angegeben'}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => openEditDialog(org)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Bearbeiten
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mitarbeitende verschieben</CardTitle>
            <CardDescription>
              Weise Mitarbeitende einer anderen Organisation zu, um deren Zugänge anzupassen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Lädt...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Mitarbeitenden gefunden.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Organisation</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead className="w-56">Neue Organisation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{member.organization?.name ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={member.role === 'SUPER_ADMIN' ? 'default' : member.role === 'ORG_ADMIN' ? 'secondary' : 'outline'}>
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={member.organization_id ?? undefined}
                            onValueChange={(value) => handleMemberOrgChange(member.id, value)}
                            disabled={memberUpdates[member.id]}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Organisation wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {organizations.map((org) => (
                                <SelectItem key={org.id} value={org.id}>
                                  {org.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOrg ? 'Organisation bearbeiten' : 'Neue Organisation anlegen'}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveOrganization}>
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={orgForm.name}
                onChange={(e) => handleOrgInputChange('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-logo">Logo URL</Label>
              <Input
                id="org-logo"
                type="url"
                placeholder="https://..."
                value={orgForm.logo_url}
                onChange={(e) => handleOrgInputChange('logo_url', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-cost-center">Kostenstelle</Label>
              <Input
                id="org-cost-center"
                value={orgForm.cost_center_code}
                onChange={(e) => handleOrgInputChange('cost_center_code', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-location">Räumlichkeiten / Standort</Label>
              <Textarea
                id="org-location"
                rows={3}
                placeholder="z.B. Gebäude A, 3. OG, Raum 2.15"
                value={orgForm.location_text}
                onChange={(e) => handleOrgInputChange('location_text', e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingOrg}>
                {savingOrg ? 'Speichern...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
