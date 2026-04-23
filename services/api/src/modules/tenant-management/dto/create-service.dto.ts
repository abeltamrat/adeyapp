export interface CreateServiceDto {
  branchId: string;
  name: string;
  code: string;
  description?: string;
  durationMinutes: number;
  price: number;
  requiresRoom?: boolean;
  requiresEmployeeSkill?: boolean;
}
