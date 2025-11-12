-- Add organization scoping and QR payload to coffee products
ALTER TABLE coffee_products
  ADD COLUMN organization_id UUID REFERENCES organizations(id),
  ADD COLUMN qr_payload TEXT;

-- Backfill organization_id using existing transactions if available
UPDATE coffee_products cp
SET organization_id = sub.organization_id
FROM (
  SELECT product_id, MAX(organization_id::text)::uuid AS organization_id
  FROM coffee_transactions
  GROUP BY product_id
) sub
WHERE cp.id = sub.product_id
  AND cp.organization_id IS NULL;

-- Replace existing product visibility policy with org-scoped version
DROP POLICY IF EXISTS "Coffee products are viewable by authenticated users" ON coffee_products;

CREATE POLICY "Coffee products are scoped to organizations"
  ON coffee_products FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'SUPER_ADMIN')
    OR organization_id = (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Allow org & super admins to manage their coffee products
CREATE POLICY "Org admins manage coffee products"
  ON coffee_products FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.is_org_admin_of(auth.uid(), organization_id)
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.is_org_admin_of(auth.uid(), organization_id)
  );

-- Tighten transaction insert checks so org can't be spoofed
DROP POLICY IF EXISTS "Authenticated users can create coffee transactions" ON coffee_transactions;

CREATE POLICY "Members can record coffee purchases"
  ON coffee_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND organization_id = (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );
