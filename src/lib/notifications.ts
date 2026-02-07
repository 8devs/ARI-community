import { api } from "@/lib/api";

export async function sendEmailNotification(to: string, subject: string, html: string) {
  if (!to) return;

  try {
    await api.mutate("/api/notifications/booking", { to, subject, html });
  } catch (error) {
    console.error("E-Mail Benachrichtigung fehlgeschlagen", error);
  }
}
