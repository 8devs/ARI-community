declare global {
  interface WindowEventMap {
    "app-branding-updated": CustomEvent<{ logoUrl?: string | null }>;
  }
}

export {};
