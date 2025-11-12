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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Building2, MapPin, Users, Pencil, PlusCircle, Mail, Phone, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';

type Organization = Tables<'organizations'>;
type ProfileRow = Tables<'profiles'> & {
  organization?: {
    name: string | null;
  } | null;
};
type CoffeeProduct = Tables<'coffee_products'>;

const emptyOrgForm = {
  name: '',
  logo_url: '',
  cost_center_code: '',
  location_text: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
};

const generateRandomPath = (prefix: string, file: File) => {
  const ext = file.name.split('.').pop();
  const cryptoRef =
    typeof globalThis !== 'undefined'
      ? ((globalThis as unknown as { crypto?: Crypto }).crypto as Crypto | undefined)
      : undefined;
  const randomString =
    cryptoRef?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}/${randomString}.${ext}`;
};

export default function AdminSettings() {
  const { profile, loading: profileLoading } = useCurrentProfile();
  const isAdmin = profile && profile.role !== 'MEMBER';
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState(emptyOrgForm);
  const [savingOrg, setSavingOrg] = useState(false);
  const [memberUpdates, setMemberUpdates] = useState<Record<string, boolean>>({});
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'MEMBER',
    organization_id: '',
  });
  const [inviting, setInviting] = useState(false);

  const [coffeeOrgId, setCoffeeOrgId] = useState<string | null>(null);
  const [coffeeProducts, setCoffeeProducts] = useState<CoffeeProduct[]>([]);
  const [coffeeLoading, setCoffeeLoading] = useState(false);
  const [coffeeError, setCoffeeError] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    qrPayload: '',
    isActive: true,
  });
  const [creatingProduct, setCreatingProduct] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    loadOrganizations();
    if (isSuperAdmin) {
      loadMembers();
    } else {
      setInviteForm((prev) => ({ ...prev, organization_id: profile?.organization_id ?? '' }));
      setCoffeeOrgId(profile?.organization_id ?? null);
      if (profile?.organization_id) {
        loadCoffeeProducts(profile.organization_id);
      }
    }
  }, [isAdmin, isSuperAdmin, profile?.organization_id]);

  useEffect(() => {
    if (isSuperAdmin && organizations.length && !inviteForm.organization_id) {
      setInviteForm((prev) => ({ ...prev, organization_id: organizations[0].id }));
    }
    if (isSuperAdmin && organizations.length && !coffeeOrgId) {
      setCoffeeOrgId(organizations[0].id);
      loadCoffeeProducts(organizations[0].id);
    }
  }, [organizations, isSuperAdmin, inviteForm.organization_id, coffeeOrgId]);

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      if (error) throw error;
      setOrganizations(data || []);
    } catch (error: any) {
      console.error('Error loading organizations', error);
      toast.error('Organisationen konnten nicht geladen werden');
    }
  };

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          organization:organizations(name)
        `)
        .order('name');
      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      console.error('Error loading members', error);
      toast.error('Mitarbeitende konnten nicht geladen werden');
    }
  };

  const loadCoffeeProducts = async (orgId: string) => {
    setCoffeeLoading(true);
    setCoffeeError(null);
    try {
      const { data, error } = await supabase
        .from('coffee_products')
        .select('*')
        .eq('organization_id', orgId)
        .order('price_cents', { ascending: true });
      if (error) throw error;
      setCoffeeProducts(data || []);
    } catch (error: any) {
      console.error('Error loading coffee products', error);
      if (error?.code === '42703') {
        setCoffeeError(
          'Die Spalte organization_id fehlt noch in coffee_products. Bitte die Migration 20251111225000_coffee_qr.sql ausführen.',
        );
      } else {
        setCoffeeError('Getränke konnten nicht geladen werden.');
      }
    } finally {
      setCoffeeLoading(false);
    }
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
      contact_name: org.contact_name ?? '',
      contact_email: org.contact_email ?? '',
      contact_phone: org.contact_phone ?? '',
    });
    setOrgDialogOpen(true);
  };

  const handleOrgInputChange = (field: keyof typeof orgForm, value: string) => {
    setOrgForm(prev => ({ ...prev, [field]: value }));
  };

  const uploadOrganizationLogo = async (file: File) => {
    const filePath = generateRandomPath('logos', file);
    const { error } = await supabase.storage
      .from('organization-logos')
      .upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('organization-logos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleOrgLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadOrganizationLogo(file);
      setOrgForm(prev => ({ ...prev, logo_url: url }));
      toast.success('Logo hochgeladen');
    } catch (error) {
      console.error('Error uploading logo', error);
      toast.error('Logo konnte nicht hochgeladen werden');
    }
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
      contact_name: orgForm.contact_name.trim() || null,
      contact_email: orgForm.contact_email.trim() || null,
      contact_phone: orgForm.contact_phone.trim() || null,
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
    setMemberUpdates(prev => ({ ...prev, [memberId]: true }));
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
    setMemberUpdates(prev => ({ ...prev, [memberId]: false }));
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

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim() || !inviteForm.organization_id) {
      toast.error('E-Mail und Organisation sind erforderlich');
      return;
    }

    setInviting(true);
    try {
      const redirectTo = `${window.location.origin}/passwort/neu`;
      const { error } = await supabase.auth.signInWithOtp({
        email: inviteForm.email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
          data: {
            role: inviteForm.role,
            organization_id: inviteForm.organization_id,
            invited_by: profile?.id ?? null,
          },
        },
      });
      if (error) throw error;
      toast.success('Einladungs-E-Mail wurde verschickt');
      setInviteForm(prev => ({
        ...prev,
        email: '',
        role: 'MEMBER',
      }));
    } catch (error: any) {
      console.error('Error sending invite', error);
      toast.error(error.message || 'Einladung konnte nicht gesendet werden');
    } finally {
      setInviting(false);
    }
  };

  const handleProductInputChange = (field: 'name' | 'price' | 'qrPayload' | 'isActive', value: string | boolean) => {
    setProductForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coffeeOrgId) {
      toast.error('Bitte wähle zuerst eine Organisation aus.');
      return;
    }
    const priceValue = Number((productForm.price || '').replace(',', '.'));
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error('Bitte gib einen gültigen Preis ein.');
      return;
    }
    setCreatingProduct(true);
    try {
      const { error } = await supabase.from('coffee_products').insert({
        name: productForm.name.trim(),
        price_cents: Math.round(priceValue * 100),
        qr_payload: productForm.qrPayload.trim() || null,
        is_active: productForm.isActive,
        organization_id: coffeeOrgId,
      });
      if (error) throw error;
      toast.success('Getränk gespeichert');
      setProductForm({
        name: '',
        price: '',
        qrPayload: '',
        isActive: true,
      });
      loadCoffeeProducts(coffeeOrgId);
    } catch (error) {
      console.error('Error creating coffee product', error);
      toast.error('Getränk konnte nicht angelegt werden');
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleToggleProduct = async (productId: string, nextState: boolean) => {
    const { error } = await supabase
      .from('coffee_products')
      .update({ is_active: nextState })
      .eq('id', productId);

    if (error) {
      console.error('Error updating product status', error);
      toast.error('Status konnte nicht geändert werden');
      return;
    }
    if (coffeeOrgId) {
      loadCoffeeProducts(coffeeOrgId);
    }
  };

  if (profileLoading) {
    return (
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Lädt...</CardTitle>
            <CardDescription>Profilinformationen werden geladen.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Bitte einen Moment Geduld.</p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Zugriff verweigert</CardTitle>
            <CardDescription>Nur Admins können diesen Bereich nutzen.</CardDescription>
          </CardHeader>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold">Administration</h1>
          <p className="text-muted-foreground">
            Verwalte Organisationen, Einladungen und Getränke zentral.
          </p>
        </div>

        <Tabs defaultValue="organizations">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="organizations">Organisationen verwalten</TabsTrigger>
            <TabsTrigger value="invites">Einladungen</TabsTrigger>
            <TabsTrigger value="coffee">Getränke</TabsTrigger>
          </TabsList>

          <TabsContent value="organizations" className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Organisationen verwalten</CardTitle>
                <CardDescription>
                  Logos, Standorte, Ansprechpartner und Mitgliedschaften pflegen.
                </CardDescription>
              </div>
              {isSuperAdmin && (
                <Button onClick={openCreateDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Organisation anlegen
                </Button>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Organisationen</CardTitle>
                <CardDescription>Alle Firmen im System</CardDescription>
              </CardHeader>
              <CardContent>
                {organizations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine Organisationen vorhanden.</p>
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
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {org.contact_name && (
                              <p className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                {org.contact_name}
                              </p>
                            )}
                            {org.contact_email && (
                              <p className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                {org.contact_email}
                              </p>
                            )}
                            {org.contact_phone && (
                              <p className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                {org.contact_phone}
                              </p>
                            )}
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

            {isSuperAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Mitarbeitende verschieben</CardTitle>
                  <CardDescription>
                    Weise Mitarbeitende anderen Organisationen zu.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {members.length === 0 ? (
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
                            <TableHead className="w-32 text-right">Aktionen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    {member.avatar_url ? (
                                      <AvatarImage src={member.avatar_url} alt={member.name} />
                                    ) : (
                                      <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    )}
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
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={!canDeleteMember(member) || deletingUserId === member.id}
                                  onClick={() => handleDeleteMember(member)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="invites" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Einladungen per E-Mail</CardTitle>
                <CardDescription>
                  Supabase verschickt automatisch Magic Links zur Registrierung.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleInviteSubmit}>
                  <div className="space-y-2">
                    <Label>E-Mail-Adresse</Label>
                    <Input
                      type="email"
                      placeholder="person@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Rolle</Label>
                      <Select
                        value={inviteForm.role}
                        onValueChange={(value) => setInviteForm(prev => ({ ...prev, role: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Rolle wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MEMBER">Mitarbeiter</SelectItem>
                          <SelectItem value="ORG_ADMIN">Organisations-Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Organisation</Label>
                      {isSuperAdmin ? (
                        <Select
                          value={inviteForm.organization_id}
                          onValueChange={(value) => setInviteForm(prev => ({ ...prev, organization_id: value }))}
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
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {profile?.organization?.name ?? 'Keine Organisation zugeordnet'}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? 'Wird eingeladen...' : 'Einladung senden'}
                  </Button>
                  <Alert>
                    <AlertTitle>Hinweis</AlertTitle>
                    <AlertDescription>
                      Die Einladungs-E-Mail führt direkt zur Passwort-Seite. Rolle & Organisation werden aus den Metadaten übernommen.
                    </AlertDescription>
                  </Alert>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coffee" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Getränke verwalten</CardTitle>
                <CardDescription>
                  Lege Kaffeeprodukte an und aktiviere/deaktiviere sie.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label>Organisation auswählen</Label>
                    <Select
                      value={coffeeOrgId ?? undefined}
                      onValueChange={(value) => {
                        setCoffeeOrgId(value);
                        loadCoffeeProducts(value);
                      }}
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
                  </div>
                )}

                {!coffeeOrgId ? (
                  <Alert>
                    <AlertTitle>Keine Organisation ausgewählt</AlertTitle>
                    <AlertDescription>
                      Bitte wähle eine Organisation aus, um Getränke zu verwalten.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <form className="space-y-4" onSubmit={handleCreateProduct}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="coffee-name">Name</Label>
                          <Input
                            id="coffee-name"
                            value={productForm.name}
                            onChange={(e) => handleProductInputChange('name', e.target.value)}
                            placeholder="z.B. Cappuccino"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="coffee-price">Preis (EUR)</Label>
                          <Input
                            id="coffee-price"
                            type="number"
                            min="0"
                            step="0.1"
                            value={productForm.price}
                            onChange={(e) => handleProductInputChange('price', e.target.value)}
                            placeholder="2.50"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="coffee-qr">QR Payload (optional)</Label>
                        <Input
                          id="coffee-qr"
                          value={productForm.qrPayload}
                          onChange={(e) => handleProductInputChange('qrPayload', e.target.value)}
                          placeholder="Payment-Link oder Beschreibung"
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">Produkt aktiv</p>
                          <p className="text-sm text-muted-foreground">
                            Nur aktive Produkte erscheinen im Self-Service.
                          </p>
                        </div>
                        <Switch
                          checked={productForm.isActive}
                          onCheckedChange={(checked) => handleProductInputChange('isActive', checked)}
                        />
                      </div>
                      <Button type="submit" disabled={creatingProduct}>
                        {creatingProduct ? 'Wird gespeichert...' : 'Getränk speichern'}
                      </Button>
                    </form>

                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Bestehende Getränke
                      </h3>
                      {coffeeError ? (
                        <Alert>
                          <AlertTitle>Getränke können nicht geladen werden</AlertTitle>
                          <AlertDescription>{coffeeError}</AlertDescription>
                        </Alert>
                      ) : coffeeLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Lädt Getränke...
                        </div>
                      ) : coffeeProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Für diese Organisation sind noch keine Getränke angelegt.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {coffeeProducts.map((product) => (
                            <div
                              key={product.id}
                              className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <p className="font-medium flex items-center gap-2">
                                  {product.name}
                                  <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                    {product.is_active ? 'Aktiv' : 'Inaktiv'}
                                  </Badge>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(product.price_cents / 100)}
                                </p>
                                {product.qr_payload && (
                                  <p className="text-xs text-muted-foreground break-all">
                                    QR: {product.qr_payload}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleProduct(product.id, !product.is_active)}
                                >
                                  {product.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
              <Label htmlFor="org-logo">Logo hochladen</Label>
              <Input
                id="org-logo"
                type="file"
                accept="image/*"
                onChange={handleOrgLogoChange}
              />
              {orgForm.logo_url && (
                <p className="text-xs text-muted-foreground break-all">{orgForm.logo_url}</p>
              )}
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-contact-name">Ansprechpartner</Label>
                <Input
                  id="org-contact-name"
                  value={orgForm.contact_name}
                  onChange={(e) => handleOrgInputChange('contact_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-contact-email">Kontakt E-Mail</Label>
                <Input
                  id="org-contact-email"
                  type="email"
                  value={orgForm.contact_email}
                  onChange={(e) => handleOrgInputChange('contact_email', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-contact-phone">Kontakt Telefon</Label>
              <Input
                id="org-contact-phone"
                value={orgForm.contact_phone}
                onChange={(e) => handleOrgInputChange('contact_phone', e.target.value)}
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
  const canDeleteMember = (member: ProfileRow) => {
    if (!profile) return false;
    if (profile.role === 'SUPER_ADMIN') return true;
    if (profile.role === 'ORG_ADMIN') {
      return (
        profile.organization_id &&
        profile.organization_id === member.organization_id &&
        member.role !== 'SUPER_ADMIN'
      );
    }
    return false;
  };

  const handleDeleteMember = async (member: ProfileRow) => {
    if (!canDeleteMember(member)) {
      toast.error('Du hast keine Berechtigung, diesen Nutzer zu löschen.');
      return;
    }
    if (!confirm(`Benutzer ${member.name} wirklich löschen?`)) {
      return;
    }
    setDeletingUserId(member.id);
    const { error } = await supabase.rpc('delete_user_with_scope', {
      _target_user_id: member.id,
    });
    if (error) {
      console.error('Error deleting user', error);
      toast.error(error.message ?? 'Nutzer konnte nicht gelöscht werden');
    } else {
      toast.success('Nutzer gelöscht');
      loadMembers();
      loadOrganizations();
    }
    setDeletingUserId(null);
  };
