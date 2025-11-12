import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Coffee as CoffeeIcon, Download } from 'lucide-react';
import { format, startOfMonth, addMonths, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { toast } from 'sonner';

type CoffeeProduct = Tables<'coffee_products'>;
type CoffeeTransaction = Tables<'coffee_transactions'> & {
  user?: { name: string | null; email: string | null } | null;
};

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export default function Coffee() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useCurrentProfile();

  const [products, setProducts] = useState<CoffeeProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [transactions, setTransactions] = useState<CoffeeTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CoffeeProduct | null>(null);
  const [savingPurchase, setSavingPurchase] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [exporting, setExporting] = useState(false);
  const [orgOptions, setOrgOptions] = useState<{ id: string; name: string; cost_center_code: string | null }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    qrPayload: '',
    isActive: true,
  });

  const isOrgAdmin = profile?.role && profile.role !== 'MEMBER';

  useEffect(() => {
    if (!profile?.organization_id) {
      return;
    }
    setSelectedOrgId((prev) => prev ?? profile.organization_id);
    loadTransactions();

    if (profile.role === 'SUPER_ADMIN') {
      loadOrganizations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organization_id, profile?.role]);

useEffect(() => {
  if (
    profile?.role === 'SUPER_ADMIN' &&
    orgOptions.length > 0 &&
    !selectedOrgId
  ) {
    setSelectedOrgId(orgOptions[0].id);
  }
}, [orgOptions, profile?.role, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId) {
      loadProducts(selectedOrgId);
    }
  }, [selectedOrgId]);

  const loadProducts = async (organizationId: string) => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('coffee_products')
        .select('*')
        .eq('organization_id', organizationId)
        .order('price_cents', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error loading coffee products', error);
      toast.error('Produkte konnten nicht geladen werden');
    } finally {
      setProductsLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!user?.id) return;
    setTransactionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('coffee_transactions')
        .select('id, created_at, price_cents_snapshot, product_name_snapshot')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error('Error loading coffee transactions', error);
      toast.error('Transaktionen konnten nicht geladen werden');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, cost_center_code')
        .order('name');

      if (error) throw error;
      setOrgOptions(data || []);
    } catch (error: any) {
      console.error('Error loading organizations', error);
      toast.error('Organisationen konnten nicht geladen werden');
    }
  };

  const handleConfirmPurchase = async () => {
    if (!selectedProduct || !user?.id || !profile?.organization_id) return;

    setSavingPurchase(true);
    try {
      const { error } = await supabase.from('coffee_transactions').insert({
        user_id: user.id,
        organization_id: profile.organization_id,
        product_id: selectedProduct.id,
        product_name_snapshot: selectedProduct.name,
        price_cents_snapshot: selectedProduct.price_cents,
      });

      if (error) throw error;
      toast.success('Danke – Deine Transaktion wurde gespeichert');
      setProductDialogOpen(false);
      setSelectedProduct(null);
      loadTransactions();
    } catch (error: any) {
      console.error('Error saving coffee transaction', error);
      toast.error('Transaktion konnte nicht gespeichert werden');
    } finally {
      setSavingPurchase(false);
    }
  };

  const handleProductInputChange = (field: 'name' | 'price' | 'qrPayload' | 'isActive', value: string | boolean) => {
    setProductForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) {
      toast.error('Bitte wähle zuerst eine Organisation aus.');
      return;
    }
    const priceValue = Number((productForm.price || '').replace(',', '.'));
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error('Bitte gib einen gültigen Preis ein.');
      return;
    }

    const priceCents = Math.round(priceValue * 100);
    setCreatingProduct(true);

    try {
      const { error } = await supabase.from('coffee_products').insert({
        name: productForm.name.trim(),
        price_cents: priceCents,
        qr_payload: productForm.qrPayload.trim() || null,
        is_active: productForm.isActive,
        organization_id: selectedOrgId,
      });

      if (error) {
        throw error;
      }

      toast.success('Getränk gespeichert');
      setProductForm({
        name: '',
        price: '',
        qrPayload: '',
        isActive: true,
      });
      loadProducts(selectedOrgId);
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
      console.error('Error updating product', error);
      toast.error('Status konnte nicht geändert werden');
      return;
    }
    if (selectedOrgId) {
      loadProducts(selectedOrgId);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedOrgId) {
      toast.error('Bitte wähle zuerst eine Organisation');
      return;
    }
    if (!selectedMonth) {
      toast.error('Bitte wähle einen Monat');
      return;
    }

    const monthDate = parseISO(`${selectedMonth}-01`);
    const start = startOfMonth(monthDate);
    const end = addMonths(start, 1);

    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('coffee_transactions')
        .select(`
          id,
          created_at,
          price_cents_snapshot,
          product_name_snapshot,
          user:profiles!coffee_transactions_user_id_fkey(name, email)
        `)
        .eq('organization_id', selectedOrgId)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      const records = data || [];
      if (records.length === 0) {
        toast.info('Keine Transaktionen für diesen Monat');
        return;
      }

      const rows = records.map((tx) => [
        format(new Date(tx.created_at), 'dd.MM.yyyy HH:mm'),
        tx.user?.name ?? 'Unbekannt',
        tx.user?.email ?? '',
        tx.product_name_snapshot,
        (tx.price_cents_snapshot / 100).toFixed(2).replace('.', ','),
      ]);

      const header = ['Datum', 'Name', 'E-Mail', 'Produkt', 'Preis (EUR)'];
      const csv = [header, ...rows]
        .map((row) =>
          row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(';'),
        )
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const orgLabel =
        orgOptions.find((org) => org.id === selectedOrgId)?.name ??
        profile?.organization?.name ??
        'organisation';
      const fileName = `coffee-${orgLabel.replace(/\s+/g, '-').toLowerCase()}-${selectedMonth}.csv`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exportiert');
    } catch (error: any) {
      console.error('Error exporting coffee CSV', error);
      toast.error('Export fehlgeschlagen');
    } finally {
      setExporting(false);
    }
  };

  const totalSpent = useMemo(
    () =>
      transactions.reduce(
        (sum, tx) => sum + (tx.price_cents_snapshot ?? 0),
        0,
      ),
    [transactions],
  );

  const activeProducts = products.filter((product) => product.is_active);

  const qrValue =
    selectedProduct &&
    (selectedProduct.qr_payload ||
      `COFFEE|${profile?.organization?.name ?? 'Organisation'}|${
        selectedProduct.name
      }|${(selectedProduct.price_cents / 100).toFixed(2)}`);

  if (profileLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Profil wird geladen...
        </div>
      </Layout>
    );
  }

  if (!profile?.organization_id) {
    return (
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Keine Organisation zugeordnet</CardTitle>
            <CardDescription>
              Für die Kaffee-Abrechnung musst Du einer Organisation zugeordnet sein.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bitte kontaktiere einen Organisations-Admin, damit Dein Profil vollständig
              eingerichtet werden kann.
            </p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold">Kaffee-Abrechnung</h1>
          <p className="text-lg text-muted-foreground">
            Getränke auswählen, QR-Code scannen und Transaktionen für die Kostenstelle dokumentieren.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Produkte</CardTitle>
            <CardDescription>
              Wähle Dein Getränk aus und scanne den QR-Code an der Kaffeemaschine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Produkte werden geladen...
              </div>
            ) : activeProducts.length === 0 ? (
              <Alert>
                <AlertTitle>Keine Produkte vorhanden</AlertTitle>
                <AlertDescription>
                  Bitte wende Dich an Deinen Organisations-Admin, um Kaffee-Produkte zu hinterlegen.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="border-primary/10 hover:shadow-md transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {currencyFormatter.format(product.price_cents / 100)}
                          </p>
                        </div>
                        <Badge variant={product.is_active ? 'default' : 'secondary'}>
                          {product.is_active ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => {
                          setSelectedProduct(product);
                          setProductDialogOpen(true);
                        }}
                      >
                        <CoffeeIcon className="mr-2 h-4 w-4" />
                        QR-Code anzeigen
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {isOrgAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Getränke verwalten</CardTitle>
              <CardDescription>
                Lege neue Kaffee- oder Getränkeoptionen an und aktiviere/deaktiviere sie bei Bedarf.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile?.role === 'SUPER_ADMIN' && (
                <div className="space-y-2">
                  <Label>Organisation verwalten</Label>
                  <Select
                    value={selectedOrgId ?? undefined}
                    onValueChange={(value) => setSelectedOrgId(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Organisation wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgOptions.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!selectedOrgId && (
                <Alert>
                  <AlertTitle>Keine Organisation ausgewählt</AlertTitle>
                  <AlertDescription>
                    Bitte wähle oben eine Organisation aus, um Getränke zu verwalten.
                  </AlertDescription>
                </Alert>
              )}

              {selectedOrgId && (
                <>
                  <form className="space-y-4" onSubmit={handleCreateProduct}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="product-name">Name</Label>
                        <Input
                          id="product-name"
                          value={productForm.name}
                          onChange={(e) => handleProductInputChange('name', e.target.value)}
                          placeholder="z.B. Cappuccino"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-price">Preis (EUR)</Label>
                        <Input
                          id="product-price"
                          type="number"
                          step="0.1"
                          min="0"
                          value={productForm.price}
                          onChange={(e) => handleProductInputChange('price', e.target.value)}
                          placeholder="2.50"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product-qr">QR Payload (optional)</Label>
                      <Input
                        id="product-qr"
                        value={productForm.qrPayload}
                        onChange={(e) => handleProductInputChange('qrPayload', e.target.value)}
                        placeholder="Beliebiger Text oder Payment-String"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">Produkt aktiv</p>
                        <p className="text-sm text-muted-foreground">
                          Nur aktive Produkte erscheinen in der Liste für Mitarbeitende.
                        </p>
                      </div>
                      <Switch
                        checked={productForm.isActive}
                        onCheckedChange={(checked) => handleProductInputChange('isActive', checked)}
                      />
                    </div>

                    <Button type="submit" disabled={creatingProduct || !selectedOrgId}>
                      Getränk speichern
                    </Button>
                  </form>

                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Bestehende Getränke ({products.length})
                    </h3>
                    {productsLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Lädt Getränke...
                      </div>
                    ) : products.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Für diese Organisation sind noch keine Getränke angelegt.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {products.map((product) => (
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
                                {currencyFormatter.format(product.price_cents / 100)}
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
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Meine Transaktionen</CardTitle>
              <CardDescription>
                Die letzten zehn Buchungen werden hier angezeigt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {transactionsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transaktionen werden geladen...
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Transaktionen gespeichert.
                </p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{tx.product_name_snapshot}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(tx.created_at), 'dd.MM.yyyy HH:mm')} Uhr
                        </p>
                      </div>
                      <span className="font-semibold">
                        {currencyFormatter.format(tx.price_cents_snapshot / 100)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Summe der angezeigten Buchungen</span>
                <span className="font-semibold text-foreground">
                  {currencyFormatter.format(totalSpent / 100)}
                </span>
              </div>
            </CardContent>
          </Card>

          {isOrgAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>CSV Export für Kostenstellen</CardTitle>
                <CardDescription>
                  Org-Admins können monatliche Reports für die Weitergabe an die Buchhaltung exportieren.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Monat</Label>
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  />
                </div>
                {profile.role === 'SUPER_ADMIN' ? (
                  <div className="space-y-1">
                    <Label>Organisation</Label>
                    <p className="text-sm text-muted-foreground">
                      {selectedOrgId
                        ? orgOptions.find((org) => org.id === selectedOrgId)?.name ?? 'Bitte oben auswählen'
                        : 'Bitte oben im Adminbereich eine Organisation auswählen.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label>Organisation</Label>
                    <p className="text-sm text-muted-foreground">
                      {profile.organization?.name}
                      {profile.organization?.cost_center_code
                        ? ` • Kostenstelle ${profile.organization.cost_center_code}`
                        : ''}
                    </p>
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={handleExportCsv}
                  disabled={exporting}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {exporting ? 'Export läuft...' : 'CSV exportieren'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Der Export enthält Datum, Mitarbeitende, Produkt und Betrag – ideal für die monatliche Kostenstellenabrechnung.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) {
            setSelectedProduct(null);
            setSavingPurchase(false);
          }
        }}
      >
        <DialogContent>
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProduct.name}</DialogTitle>
                <DialogDescription>
                  Preis: {currencyFormatter.format(selectedProduct.price_cents / 100)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                {qrValue ? (
                  <>
                    <div className="rounded-lg border p-4 bg-white">
                      <QRCode value={qrValue} size={200} />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Zeige den QR-Code an der Kaffeemaschine oder speichere ihn in Deinem Wallet.
                    </p>
                  </>
                ) : (
                  <Alert>
                    <AlertTitle>Kein QR-Code hinterlegt</AlertTitle>
                    <AlertDescription>
                      Bitte informiere Deinen Organisations-Admin, damit ein QR-Payload für dieses Produkt
                      erfasst wird.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleConfirmPurchase}
                  disabled={!qrValue || savingPurchase}
                >
                  {savingPurchase ? 'Speichern...' : 'Ich habe gezahlt'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
