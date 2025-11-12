-- Allow organizations without a logo
ALTER TABLE organizations
  ALTER COLUMN logo_url DROP NOT NULL;
