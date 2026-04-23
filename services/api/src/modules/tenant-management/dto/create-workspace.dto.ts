export interface CreateWorkspaceDto {
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  country: string;
  branch: {
    name: string;
    code: string;
    timezone?: string;
    city?: string;
    phone?: string;
    email?: string;
    approvedNetworkIdentifiers?: string[];
  };
}
