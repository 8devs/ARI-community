import { supabase } from "@/integrations/supabase/client";

export async function sendEmailNotification(to: string, subject: string, html: string) {
  if (!to) return;

  const { error } = await supabase.functions.invoke("send-email-notification", {
    body: { to, subject, html },
  });

  if (error) {
    console.error("E-Mail Benachrichtigung fehlgeschlagen", error);
  }
}
