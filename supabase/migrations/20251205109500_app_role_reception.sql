-- Extend app_role with reception staff permission
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'RECEPTION';
