// Centralized API client – replaces all direct Supabase client calls
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  params?: Record<string, string>;
};

async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {};
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, errorData.error ?? "Request failed");
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Auth ────────────────────────────────────────────────────────────
export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: any }>("/api/auth/login", { method: "POST", body: { email, password } }),
    logout: () => request("/api/auth/logout", { method: "POST" }),
    session: () => request<{ user: any }>("/api/auth/session"),
    register: (data: any) => request("/api/auth/register", { method: "POST", body: data }),
    requestPasswordReset: (email: string) =>
      request("/api/auth/password/request-reset", { method: "POST", body: { email } }),
    resetPassword: (token: string, password: string) =>
      request("/api/auth/password/reset", { method: "POST", body: { token, password } }),
    updatePassword: (password: string) =>
      request("/api/auth/password/update", { method: "POST", body: { password } }),
    deleteUser: (user_id: string) =>
      request("/api/auth/members/delete", { method: "POST", body: { user_id } }),
    invitations: {
      create: (data: any) => request("/api/auth/invitations/create", { method: "POST", body: data }),
      details: (token: string) =>
        request("/api/auth/invitations/details", { params: { token } }),
      accept: (data: { token: string; password: string; name: string }) =>
        request("/api/auth/invitations/accept", { method: "POST", body: data }),
    },
  },

  data: {
    profile: () => request<{ profile: any }>("/api/data/profile"),
    members: () => request<{ members: any[] }>("/api/data/members"),
    organizations: () => request<{ organizations: any[] }>("/api/data/organizations"),
  },

  // ─── Generic CRUD for all tables ──────────────────────────────────
  // These replace direct Supabase queries
  query: <T = any>(path: string, params?: Record<string, string>) =>
    request<T>(path, { params }),

  mutate: <T = any>(path: string, body: any, method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST") =>
    request<T>(path, { method, body }),

  upload: async (bucket: string, file: File, oldUrl?: string): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    if (oldUrl) formData.append("old_url", oldUrl);
    return request(`/api/upload/${bucket}`, { method: "POST", body: formData });
  },
};
