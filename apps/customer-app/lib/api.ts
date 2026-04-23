import { createApiClient } from "@adeyapp/api-client";

const fallbackBaseUrl = "http://127.0.0.1:8080";
let accessToken: string | undefined;

export const customerApi = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? fallbackBaseUrl,
  getAccessToken: () => accessToken
});

export function setCustomerApiAccessToken(token?: string) {
  accessToken = token;
  customerApi.setAccessToken(token);
}
