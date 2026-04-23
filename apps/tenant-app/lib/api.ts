import { createApiClient } from "@adeyapp/api-client";

const fallbackBaseUrl = "http://127.0.0.1:8080";

export const tenantApi = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? fallbackBaseUrl
});

export function setTenantApiAccessToken(token?: string) {
  tenantApi.setAccessToken(token);
}
