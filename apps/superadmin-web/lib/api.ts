import { createApiClient } from "@adeyapp/api-client";

const fallbackBaseUrl = "http://127.0.0.1:8080";
const tokenStorageKey = "adeyapp.superadmin.accessToken";

export const superadminApi = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? fallbackBaseUrl
});

export function hydrateSuperadminApi() {
  if (typeof window === "undefined") {
    return;
  }

  const token = window.localStorage.getItem(tokenStorageKey) ?? undefined;
  superadminApi.setAccessToken(token);
}

export function saveSuperadminToken(token: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(tokenStorageKey, token);
  }
  superadminApi.setAccessToken(token);
}

export function clearSuperadminToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(tokenStorageKey);
  }
  superadminApi.setAccessToken(undefined);
}

export function hasSuperadminToken() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.localStorage.getItem(tokenStorageKey));
}
