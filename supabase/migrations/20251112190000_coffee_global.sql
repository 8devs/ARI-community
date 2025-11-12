-- Revert coffee products to a global catalog without QR payloads
ALTER TABLE coffee_products
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS qr_payload;

DROP POLICY IF EXISTS "Coffee products are scoped to organizations" ON coffee_products;
DROP POLICY IF EXISTS "Org admins manage coffee products" ON coffee_products;

CREATE POLICY "Coffee products are viewable by members"
  ON coffee_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage coffee products"
  ON coffee_products FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR public.has_role(auth.uid(), 'ORG_ADMIN')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR public.has_role(auth.uid(), 'ORG_ADMIN')
  );
