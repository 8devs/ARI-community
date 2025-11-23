-- Ensure lunch menu bucket is present and public
INSERT INTO storage.buckets (id, name, public)
VALUES ('lunch-menus', 'lunch-menus', TRUE)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = TRUE
WHERE id = 'lunch-menus';
