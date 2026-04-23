import type {
  AppointmentSummary,
  AttendanceCorrectionSummary,
  OperationPolicySummary,
  PolicyAcknowledgementSummary,
  BranchBookingPolicySummary,
  AttendancePayrollSnapshotSummary,
  AttendancePayrollSummary,
  AttendanceSummary,
  AuthSession,
  CustomerAccountProfile,
  CustomerSummary,
  EmployeeSummary,
  InventoryItemSummary,
  NotificationSummary,
  OperationsReportSummary,
  LeaveTypeSummary,
  LeaveBalanceSummary,
  LeaveRequestSummary,
  CreditRequestSummary,
  PayrollBatchSummary,
  SupplierSummary,
  PurchaseOrderSummary,
  TenantBillingSummary,
  ProductSummary,
  PublicCatalogSummary,
  PublicWorkspaceSummary,
  SuperadminAuditEntrySummary,
  SuperadminDashboardSummary,
  SuperadminTenantDetail,
  SuperadminTenantSummary,
  TenantModuleEntitlements,
  WaitlistEntrySummary,
  SuperadminTenantUsageSummary,
  SupportTicketSummary,
  ShiftAssignmentSummary,
  ShiftTemplateSummary
} from "@adeyapp/types";

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | undefined;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  status: number;
}

export class ApiError extends Error {
  constructor(public readonly details: ApiErrorShape) {
    super(details.message);
    this.name = "ApiError";
  }
}

export interface RegisterOwnerPayload {
  email: string;
  password: string;
  fullName?: string;
}

export interface RegisterCustomerPayload {
  tenantSlug: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  marketingConsent?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface SelectTenantPayload {
  tenantSlug: string;
}

export interface CreateWorkspacePayload {
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

export interface WorkspaceResponse {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  branch: {
    id: string;
    name: string;
    code: string;
    timezone: string;
  };
}

export interface BranchSetupSummary {
  id: string;
  name: string;
  code: string;
  timezone: string;
  isDefault: boolean;
  rooms: Array<{
    id: string;
    name: string;
    code: string;
    roomType: string | null;
    capacity: number;
    cleanupBufferMinutes: number;
  }>;
  services: Array<{
    id: string;
    name: string;
    code: string;
    durationMinutes: number;
    price: string;
    requiresRoom: boolean;
    requiresEmployeeSkill: boolean;
  }>;
  products: ProductSummary[];
}

export interface CreateRoomPayload {
  branchId: string;
  name: string;
  code: string;
  roomType?: string;
  capacity?: number;
  cleanupBufferMinutes?: number;
}

export interface CreateServicePayload {
  branchId: string;
  name: string;
  code: string;
  description?: string;
  durationMinutes: number;
  price: number;
  requiresRoom?: boolean;
  requiresEmployeeSkill?: boolean;
}

export interface CreateProductPayload {
  branchId: string;
  name: string;
  sku: string;
  description?: string;
  unitPrice: number;
  costPrice?: number;
  isRetail?: boolean;
  startingQuantity?: number;
  reorderLevel?: number;
}

export interface ListInventoryParams {
  branchId?: string;
}

export interface InventorySummary extends InventoryItemSummary {
  branchId: string;
  productName: string;
  productSku: string;
  productDescription?: string | null;
  unitPrice: string;
  costPrice?: string | null;
  isRetail: boolean;
}

export interface AdjustInventoryPayload {
  quantityOnHand: number;
  reorderLevel?: number;
  note?: string;
}

export interface ListEmployeesParams {
  branchId?: string;
}

export interface CreateEmployeePayload {
  branchId: string;
  email: string;
  password: string;
  employeeCode: string;
  phone?: string;
  roleType?: EmployeeSummary["roleType"];
  creditEligible?: boolean;
  canEarnCommission?: boolean;
}

export interface UpdateEmployeeRolePayload {
  roleType: EmployeeSummary["roleType"];
}

export interface UpdateEmployeeCreditEligibilityPayload {
  creditEligible: boolean;
  note?: string;
}

export interface UpdateEmployeeStatusPayload {
  employmentStatus: EmployeeSummary["employmentStatus"];
  note?: string;
  finalSettlementConfirmed?: boolean;
  accessRevokedConfirmed?: boolean;
  assetRecoveryConfirmed?: boolean;
  creditReviewedConfirmed?: boolean;
}

export interface UpdateOperationPolicyPayload {
  managerCanCorrectAttendance: boolean;
  managerCanSuspendStaff: boolean;
  bookingCancellationWindowHours: number;
  bookingLeadTimeMinutes: number;
  cleanupBufferMinutes: number;
  sensitiveInventoryAdjustments: boolean;
  sensitiveAttendanceCorrections: boolean;
  sensitiveAppointmentStatusChanges: boolean;
  sensitiveEmployeeStatusChanges: boolean;
}

export interface UpdatePolicyAcknowledgementPayload {
  enabled: boolean;
  version: string;
  title: string;
  body: string;
  requiredRoles: Array<"manager" | "receptionist" | "employee">;
}

export interface UpdateTenantModulesPayload {
  inventory: boolean;
  employeeCredit: boolean;
  notifications: boolean;
  customerAccounts: boolean;
}

export interface UpdateBranchBookingPolicyPayload {
  branchId: string;
  useWorkspaceCancellationWindow: boolean;
  bookingCancellationWindowHours: number;
  useWorkspaceLeadTime: boolean;
  bookingLeadTimeMinutes: number;
  useWorkspaceCleanupBuffer: boolean;
  cleanupBufferMinutes: number;
}

export interface ListShiftAssignmentsParams {
  branchId?: string;
  date?: string;
}

export interface CreateShiftTemplatePayload {
  branchId: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes?: number;
}

export interface CreateShiftAssignmentPayload {
  branchId: string;
  employeeId: string;
  shiftTemplateId: string;
  shiftDate: string;
}

export interface ListCustomersParams {
  branchId?: string;
  search?: string;
}

export interface CreateCustomerPayload {
  branchId?: string;
  fullName: string;
  phone?: string;
  email?: string;
  notes?: string;
  marketingConsent?: boolean;
}

export interface ListAppointmentsParams {
  branchId?: string;
  date?: string;
}

export interface ListWaitlistParams {
  branchId?: string;
  status?: WaitlistEntrySummary["status"];
}

export interface AttendanceRangeParams {
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ListLeaveBalancesParams {
  branchId?: string;
  employeeId?: string;
}

export interface ListLeaveRequestsParams {
  branchId?: string;
  status?: LeaveRequestSummary["status"];
}

export interface ListCreditRequestsParams {
  branchId?: string;
  status?: CreditRequestSummary["status"];
}

export interface ListPurchaseOrdersParams {
  branchId?: string;
  status?: PurchaseOrderSummary["status"];
}

export interface CreateAttendancePayrollSnapshotPayload {
  branchId?: string;
  fromDate: string;
  toDate: string;
  note?: string;
}

export interface CreateLeaveTypePayload {
  branchId?: string;
  name: string;
  code: string;
  isPaid?: boolean;
  defaultBalanceDays?: number;
  requiresDocument?: boolean;
}

export interface AdjustLeaveBalancePayload {
  employeeId: string;
  leaveTypeId: string;
  balanceDays: number;
  usedDays?: number;
  carriedOverDays?: number;
}

export interface CreateLeaveRequestPayload {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface UpdateLeaveRequestStatusPayload {
  status: "approved" | "rejected" | "canceled";
  managerNote?: string;
}

export interface CreateCreditRequestPayload {
  amount: number;
  reason?: string;
}

export interface UpdateCreditRequestStatusPayload {
  status: "approved" | "rejected";
  approvedAmount?: number;
  ownerNote?: string;
}

export interface CreatePayrollBatchPayload {
  branchId?: string;
  fromDate: string;
  toDate: string;
  hourlyRate: number;
  latePenaltyPerMinute?: number;
  includeCreditDeductions?: boolean;
  note?: string;
}

export interface CreateSupplierPayload {
  branchId?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface CreatePurchaseOrderPayload {
  branchId: string;
  supplierId: string;
  note?: string;
  items: Array<{
    productId: string;
    quantityOrdered: number;
    unitCost: number;
  }>;
}

export interface ReceivePurchaseOrderPayload {
  note?: string;
  items: Array<{
    purchaseOrderItemId: string;
    quantityReceived: number;
  }>;
}

export interface CreateAppointmentPayload {
  branchId: string;
  customerId: string;
  serviceId: string;
  roomId?: string;
  employeeId?: string;
  startAt: string;
  notes?: string;
}

export interface CreateWaitlistEntryPayload {
  branchId: string;
  customerId: string;
  serviceId: string;
  preferredStartAt?: string;
  note?: string;
}

export interface UpdateWaitlistStatusPayload {
  status: WaitlistEntrySummary["status"];
  note?: string;
}

export interface PromoteWaitlistEntryPayload {
  roomId?: string;
  employeeId?: string;
  startAt: string;
  notes?: string;
}

export interface UpdateAppointmentStatusPayload {
  status: AppointmentSummary["status"];
}

export interface AssignAppointmentEmployeePayload {
  employeeId?: string;
}

export interface AttendancePayload {
  networkIdentifier?: string;
  gpsLatitude?: string;
  gpsLongitude?: string;
}

export interface CorrectAttendancePayload {
  attendanceStatus?: AttendanceSummary["attendanceStatus"];
  latenessMinutes?: number;
  exceptionFlag?: boolean;
  checkInAt?: string;
  checkOutAt?: string;
  note?: string;
}

export interface PublicCatalogParams {
  tenantSlug: string;
}

export interface PublicBookingPayload {
  tenantSlug: string;
  branchId: string;
  serviceId: string;
  roomId?: string;
  fullName: string;
  phone?: string;
  email?: string;
  startAt: string;
  notes?: string;
}

export interface PublicBookingLookupParams {
  tenantSlug: string;
  phone?: string;
  email?: string;
}

export interface UpdateCustomerProfilePayload {
  fullName: string;
  phone?: string;
  dateOfBirth?: string;
  preferences?: Record<string, unknown>;
  marketingConsent?: boolean;
}

export interface UpdateTenantStatusPayload {
  status: SuperadminTenantSummary["status"];
  note?: string;
}

export interface UpsertSubscriptionPayload {
  planCode: string;
  status: "trial" | "active" | "past_due" | "grace_period" | "suspended" | "canceled";
  renewsAt?: string;
  graceEndsAt?: string;
  note?: string;
}

export interface CreateInvoicePayload {
  totalAmount: number;
  dueAt?: string;
  status?: "draft" | "issued" | "paid" | "void" | "overdue";
  note?: string;
}

export interface RecordPaymentPayload {
  amount: number;
  paymentMethod: string;
  status?: "pending" | "succeeded" | "failed";
  providerReference?: string;
  receivedAt?: string;
  note?: string;
}

export interface MaintenanceAnnouncementPayload {
  title: string;
  body: string;
}

export interface TrialEndingScanPayload {
  daysAhead?: number;
}

export interface ListSupportTicketsParams {
  tenantId?: string;
  status?: string;
}

export interface CreateSupportTicketPayload {
  branchId?: string;
  subject: string;
  body: string;
  category?: string;
  priority?: SupportTicketSummary["priority"];
}

export interface UpdateSupportTicketPayload {
  status: SupportTicketSummary["status"];
  internalNote?: string;
  resolutionNote?: string;
  assignedToUserId?: string;
}

export interface ListSuperadminAuditParams {
  tenantId?: string;
  actionKey?: string;
  limit?: string;
}

export interface ListSuperadminUsageParams {
  tenantId?: string;
}

export function createApiClient(config: ApiClientConfig) {
  let accessToken = config.getAccessToken?.();

  function resolveAccessToken() {
    return config.getAccessToken?.() ?? accessToken;
  }

  const buildHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    const token = resolveAccessToken();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    return headers;
  };

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        ...buildHeaders(),
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      const body = (await safeJson(response)) as Partial<ApiErrorShape> | undefined;
      throw new ApiError({
        code: body?.code ?? "request_failed",
        message: body?.message ?? `Request failed with status ${response.status}`,
        status: response.status
      });
    }

    return (await safeJson(response)) as T;
  }

  return {
    setAccessToken(token?: string) {
      accessToken = token;
    },
    auth: {
      registerOwner(payload: RegisterOwnerPayload) {
        return request<AuthSession>("/api/v1/auth/register-owner", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      registerCustomer(payload: RegisterCustomerPayload) {
        return request<AuthSession>("/api/v1/auth/register-customer", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      login(payload: LoginPayload) {
        return request<AuthSession>("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      me() {
        return request<AuthSession>("/api/v1/auth/me");
      },
      selectTenant(payload: SelectTenantPayload) {
        return request<AuthSession>("/api/v1/auth/select-tenant", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
    },
    tenantManagement: {
      createWorkspace(payload: CreateWorkspacePayload) {
        return request<WorkspaceResponse>("/api/v1/tenant-management/workspaces", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listWorkspaces() {
        return request<Array<WorkspaceResponse["tenant"] & { branches: WorkspaceResponse["branch"][] }>>(
          "/api/v1/tenant-management/workspaces"
        );
      },
      listBranches() {
        return request<BranchSetupSummary[]>("/api/v1/tenant-management/branches");
      },
      createRoom(payload: CreateRoomPayload) {
        return request<BranchSetupSummary["rooms"][number]>("/api/v1/tenant-management/rooms", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      createService(payload: CreateServicePayload) {
        return request<BranchSetupSummary["services"][number]>(
          "/api/v1/tenant-management/services",
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
      },
      createProduct(payload: CreateProductPayload) {
        return request<ProductSummary>("/api/v1/tenant-management/products", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listInventory(params?: ListInventoryParams) {
        const search = buildQuery(params);
        return request<InventorySummary[]>(`/api/v1/tenant-management/inventory${search}`);
      },
      adjustInventory(inventoryId: string, payload: AdjustInventoryPayload) {
        return request<InventorySummary>(`/api/v1/tenant-management/inventory/${inventoryId}/adjust`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listEmployees(params?: ListEmployeesParams) {
        const search = buildQuery(params);
        return request<EmployeeSummary[]>(`/api/v1/tenant-management/employees${search}`);
      },
      listAttendance(params?: ListAppointmentsParams) {
        const search = buildQuery(params);
        return request<AttendanceSummary[]>(`/api/v1/tenant-management/attendance${search}`);
      },
      listAttendancePayrollSummary(params?: AttendanceRangeParams) {
        const search = buildQuery(params);
        return request<AttendancePayrollSummary[]>(
          `/api/v1/tenant-management/attendance/payroll-summary${search}`
        );
      },
      listAttendanceCorrections(params?: AttendanceRangeParams) {
        const search = buildQuery(params);
        return request<AttendanceCorrectionSummary[]>(
          `/api/v1/tenant-management/attendance/corrections${search}`
        );
      },
      getOperationPolicies() {
        return request<OperationPolicySummary>("/api/v1/tenant-management/policies/operations");
      },
      getModules() {
        return request<TenantModuleEntitlements>("/api/v1/tenant-management/modules");
      },
      getOperationsReport(params?: AttendanceRangeParams) {
        const search = buildQuery(params);
        return request<OperationsReportSummary>(`/api/v1/tenant-management/reports/operations-summary${search}`);
      },
      listLeaveTypes(params?: ListEmployeesParams) {
        const search = buildQuery(params);
        return request<LeaveTypeSummary[]>(`/api/v1/tenant-management/leave/types${search}`);
      },
      createLeaveType(payload: CreateLeaveTypePayload) {
        return request<LeaveTypeSummary>("/api/v1/tenant-management/leave/types", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listLeaveBalances(params?: ListLeaveBalancesParams) {
        const search = buildQuery(params);
        return request<LeaveBalanceSummary[]>(`/api/v1/tenant-management/leave/balances${search}`);
      },
      adjustLeaveBalance(payload: AdjustLeaveBalancePayload) {
        return request<LeaveBalanceSummary>("/api/v1/tenant-management/leave/balances", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listLeaveRequests(params?: ListLeaveRequestsParams) {
        const search = buildQuery(params);
        return request<LeaveRequestSummary[]>(`/api/v1/tenant-management/leave/requests${search}`);
      },
      updateLeaveRequestStatus(leaveRequestId: string, payload: UpdateLeaveRequestStatusPayload) {
        return request<LeaveRequestSummary>(`/api/v1/tenant-management/leave/requests/${leaveRequestId}/status`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listCreditRequests(params?: ListCreditRequestsParams) {
        const search = buildQuery(params);
        return request<CreditRequestSummary[]>(`/api/v1/tenant-management/credit-requests${search}`);
      },
      updateCreditRequestStatus(creditRequestId: string, payload: UpdateCreditRequestStatusPayload) {
        return request<CreditRequestSummary>(`/api/v1/tenant-management/credit-requests/${creditRequestId}/status`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listPayrollBatches(params?: AttendanceRangeParams) {
        const search = buildQuery(params);
        return request<PayrollBatchSummary[]>(`/api/v1/tenant-management/payroll/batches${search}`);
      },
      createPayrollBatch(payload: CreatePayrollBatchPayload) {
        return request<PayrollBatchSummary>("/api/v1/tenant-management/payroll/batches", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listSuppliers(params?: ListEmployeesParams) {
        const search = buildQuery(params);
        return request<SupplierSummary[]>(`/api/v1/tenant-management/suppliers${search}`);
      },
      createSupplier(payload: CreateSupplierPayload) {
        return request<SupplierSummary>("/api/v1/tenant-management/suppliers", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listPurchaseOrders(params?: ListPurchaseOrdersParams) {
        const search = buildQuery(params);
        return request<PurchaseOrderSummary[]>(`/api/v1/tenant-management/purchase-orders${search}`);
      },
      createPurchaseOrder(payload: CreatePurchaseOrderPayload) {
        return request<PurchaseOrderSummary>("/api/v1/tenant-management/purchase-orders", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      receivePurchaseOrder(purchaseOrderId: string, payload: ReceivePurchaseOrderPayload) {
        return request<PurchaseOrderSummary>(`/api/v1/tenant-management/purchase-orders/${purchaseOrderId}/receive`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      updateOperationPolicies(payload: UpdateOperationPolicyPayload) {
        return request<OperationPolicySummary>("/api/v1/tenant-management/policies/operations", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      getPolicyAcknowledgement() {
        return request<PolicyAcknowledgementSummary>(
          "/api/v1/tenant-management/policies/acknowledgement"
        );
      },
      updatePolicyAcknowledgement(payload: UpdatePolicyAcknowledgementPayload) {
        return request<PolicyAcknowledgementSummary>(
          "/api/v1/tenant-management/policies/acknowledgement",
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
      },
      getBranchBookingPolicies(branchId: string) {
        return request<BranchBookingPolicySummary>(
          `/api/v1/tenant-management/policies/branch-booking${buildQuery({ branchId })}`
        );
      },
      updateBranchBookingPolicies(payload: UpdateBranchBookingPolicyPayload) {
        return request<BranchBookingPolicySummary>(
          "/api/v1/tenant-management/policies/branch-booking",
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
      },
      listAttendancePayrollSnapshots(params?: AttendanceRangeParams) {
        const search = buildQuery(params);
        return request<AttendancePayrollSnapshotSummary[]>(
          `/api/v1/tenant-management/attendance/payroll-snapshots${search}`
        );
      },
      getBillingSummary() {
        return request<TenantBillingSummary>("/api/v1/tenant-management/billing-summary");
      },
      listSupportTickets(params?: ListSupportTicketsParams) {
        const search = buildQuery(params);
        return request<SupportTicketSummary[]>(`/api/v1/tenant-management/support-tickets${search}`);
      },
      createSupportTicket(payload: CreateSupportTicketPayload) {
        return request<SupportTicketSummary>("/api/v1/tenant-management/support-tickets", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      createAttendancePayrollSnapshot(payload: CreateAttendancePayrollSnapshotPayload) {
        return request<AttendancePayrollSnapshotSummary>(
          "/api/v1/tenant-management/attendance/payroll-snapshots",
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
      },
      correctAttendance(attendanceId: string, payload: CorrectAttendancePayload) {
        return request<AttendanceSummary>(`/api/v1/tenant-management/attendance/${attendanceId}/correct`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listShiftTemplates(params?: ListEmployeesParams) {
        const search = buildQuery(params);
        return request<ShiftTemplateSummary[]>(`/api/v1/tenant-management/shift-templates${search}`);
      },
      createShiftTemplate(payload: CreateShiftTemplatePayload) {
        return request<ShiftTemplateSummary>("/api/v1/tenant-management/shift-templates", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listShiftAssignments(params?: ListShiftAssignmentsParams) {
        const search = buildQuery(params);
        return request<ShiftAssignmentSummary[]>(`/api/v1/tenant-management/shift-assignments${search}`);
      },
      createShiftAssignment(payload: CreateShiftAssignmentPayload) {
        return request<ShiftAssignmentSummary>("/api/v1/tenant-management/shift-assignments", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      createEmployee(payload: CreateEmployeePayload) {
        return request<EmployeeSummary>("/api/v1/tenant-management/employees", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      updateEmployeeRole(employeeId: string, payload: UpdateEmployeeRolePayload) {
        return request<EmployeeSummary>(`/api/v1/tenant-management/employees/${employeeId}/role`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      updateEmployeeCreditEligibility(
        employeeId: string,
        payload: UpdateEmployeeCreditEligibilityPayload
      ) {
        return request<EmployeeSummary>(
          `/api/v1/tenant-management/employees/${employeeId}/credit-eligibility`,
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
      },
      updateEmployeeStatus(employeeId: string, payload: UpdateEmployeeStatusPayload) {
        return request<EmployeeSummary>(`/api/v1/tenant-management/employees/${employeeId}/status`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
    },
    notifications: {
      list() {
        return request<NotificationSummary[]>("/api/v1/notifications");
      },
      markRead(notificationId: string) {
        return request<NotificationSummary>(`/api/v1/notifications/${notificationId}/read`, {
          method: "POST",
          body: JSON.stringify({})
        });
      }
    },
    policies: {
      getCurrentAcknowledgement() {
        return request<PolicyAcknowledgementSummary>("/api/v1/policies/acknowledgement/current");
      },
      acknowledgeCurrent() {
        return request<PolicyAcknowledgementSummary>("/api/v1/policies/acknowledgement/acknowledge", {
          method: "POST",
          body: JSON.stringify({})
        });
      }
    },
    reception: {
      listCustomers(params?: ListCustomersParams) {
        const search = buildQuery(params);
        return request<CustomerSummary[]>(`/api/v1/reception/customers${search}`);
      },
      listWaitlist(params?: ListWaitlistParams) {
        const search = buildQuery(params);
        return request<WaitlistEntrySummary[]>(`/api/v1/reception/waitlist${search}`);
      },
      createWaitlistEntry(payload: CreateWaitlistEntryPayload) {
        return request<WaitlistEntrySummary>("/api/v1/reception/waitlist", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      updateWaitlistStatus(waitlistEntryId: string, payload: UpdateWaitlistStatusPayload) {
        return request<WaitlistEntrySummary>(`/api/v1/reception/waitlist/${waitlistEntryId}/status`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      promoteWaitlistEntry(waitlistEntryId: string, payload: PromoteWaitlistEntryPayload) {
        return request<AppointmentSummary>(`/api/v1/reception/waitlist/${waitlistEntryId}/promote`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      createCustomer(payload: CreateCustomerPayload) {
        return request<CustomerSummary>("/api/v1/reception/customers", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listAppointments(params?: ListAppointmentsParams) {
        const search = buildQuery(params);
        return request<AppointmentSummary[]>(`/api/v1/reception/appointments${search}`);
      },
      createAppointment(payload: CreateAppointmentPayload) {
        return request<AppointmentSummary>("/api/v1/reception/appointments", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      updateAppointmentStatus(appointmentId: string, payload: UpdateAppointmentStatusPayload) {
        return request<AppointmentSummary>(
          `/api/v1/reception/appointments/${appointmentId}/status`,
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
      },
      assignAppointmentEmployee(
        appointmentId: string,
        payload: AssignAppointmentEmployeePayload
      ) {
        return request<AppointmentSummary>(
          `/api/v1/reception/appointments/${appointmentId}/assign-employee`,
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
      }
    },
    employee: {
      listLeaveTypes() {
        return request<LeaveTypeSummary[]>("/api/v1/employee/leave/types");
      },
      listLeaveBalances() {
        return request<LeaveBalanceSummary[]>("/api/v1/employee/leave/balances");
      },
      listLeaveRequests() {
        return request<LeaveRequestSummary[]>("/api/v1/employee/leave/requests");
      },
      createLeaveRequest(payload: CreateLeaveRequestPayload) {
        return request<LeaveRequestSummary>("/api/v1/employee/leave/requests", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listCreditRequests() {
        return request<CreditRequestSummary[]>("/api/v1/employee/credit-requests");
      },
      createCreditRequest(payload: CreateCreditRequestPayload) {
        return request<CreditRequestSummary>("/api/v1/employee/credit-requests", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listAppointments(params?: ListAppointmentsParams) {
        const search = buildQuery(params);
        return request<AppointmentSummary[]>(`/api/v1/employee/appointments${search}`);
      },
      listAttendance(params?: ListAppointmentsParams) {
        const search = buildQuery(params);
        return request<AttendanceSummary[]>(`/api/v1/employee/attendance${search}`);
      },
      checkIn(payload: AttendancePayload) {
        return request<AttendanceSummary>("/api/v1/employee/attendance/check-in", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      checkOut(payload: AttendancePayload) {
        return request<AttendanceSummary>("/api/v1/employee/attendance/check-out", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      startService(appointmentId: string) {
        return request<AppointmentSummary>(`/api/v1/employee/appointments/${appointmentId}/start-service`, {
          method: "POST",
          body: JSON.stringify({})
        });
      },
      completeService(appointmentId: string) {
        return request<AppointmentSummary>(
          `/api/v1/employee/appointments/${appointmentId}/complete-service`,
          {
            method: "POST",
            body: JSON.stringify({})
          }
        );
      }
    },
    customer: {
      getProfile() {
        return request<CustomerAccountProfile>("/api/v1/customer/profile");
      },
      updateProfile(payload: UpdateCustomerProfilePayload) {
        return request<CustomerAccountProfile>("/api/v1/customer/profile", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listAppointments() {
        return request<AppointmentSummary[]>("/api/v1/customer/appointments");
      }
    },
    public: {
      listWorkspaces() {
        return request<PublicWorkspaceSummary[]>("/api/v1/public/workspaces");
      },
      getCatalog(params: PublicCatalogParams) {
        const search = buildQuery(params);
        return request<PublicCatalogSummary>(`/api/v1/public/catalog${search}`);
      },
      createBooking(payload: PublicBookingPayload) {
        return request<AppointmentSummary>("/api/v1/public/bookings", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      listBookings(params: PublicBookingLookupParams) {
        const search = buildQuery(params);
        return request<AppointmentSummary[]>(`/api/v1/public/bookings${search}`);
      }
    },
    superadmin: {
      getDashboard() {
        return request<SuperadminDashboardSummary>("/api/v1/superadmin/dashboard");
      },
      listAuditEntries(params?: ListSuperadminAuditParams) {
        const search = buildQuery(params);
        return request<SuperadminAuditEntrySummary[]>(`/api/v1/superadmin/audit${search}`);
      },
      listUsage(params?: ListSuperadminUsageParams) {
        const search = buildQuery(params);
        return request<SuperadminTenantUsageSummary[]>(`/api/v1/superadmin/usage${search}`);
      },
      listTenants() {
        return request<SuperadminTenantSummary[]>("/api/v1/superadmin/tenants");
      },
      getTenant(tenantId: string) {
        return request<SuperadminTenantDetail>(`/api/v1/superadmin/tenants/${tenantId}`);
      },
      updateTenantModules(tenantId: string, payload: UpdateTenantModulesPayload) {
        return request<SuperadminTenantDetail>(`/api/v1/superadmin/tenants/${tenantId}/modules`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      updateTenantStatus(tenantId: string, payload: UpdateTenantStatusPayload) {
        return request<SuperadminTenantDetail>(`/api/v1/superadmin/tenants/${tenantId}/status`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      upsertSubscription(tenantId: string, payload: UpsertSubscriptionPayload) {
        return request<SuperadminTenantDetail>(
          `/api/v1/superadmin/tenants/${tenantId}/subscription`,
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
      },
      createInvoice(tenantId: string, payload: CreateInvoicePayload) {
        return request<SuperadminTenantDetail>(`/api/v1/superadmin/tenants/${tenantId}/invoices`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      recordPayment(invoiceId: string, payload: RecordPaymentPayload) {
        return request<SuperadminTenantDetail>(`/api/v1/superadmin/invoices/${invoiceId}/payments`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      sendMaintenanceAnnouncement(payload: MaintenanceAnnouncementPayload) {
        return request<{ deliveredCount: number }>("/api/v1/superadmin/maintenance-announcement", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      runTrialEndingScan(payload?: TrialEndingScanPayload) {
        return request<{ deliveredCount: number; daysAhead: number }>(
          "/api/v1/superadmin/trial-ending-scan",
          {
            method: "POST",
            body: JSON.stringify(payload ?? {})
          }
        );
      },
      listSupportTickets(params?: ListSupportTicketsParams) {
        const search = buildQuery(params);
        return request<SupportTicketSummary[]>(`/api/v1/superadmin/support-tickets${search}`);
      },
      updateSupportTicket(ticketId: string, payload: UpdateSupportTicketPayload) {
        return request<SupportTicketSummary>(`/api/v1/superadmin/support-tickets/${ticketId}/status`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
    }
  };
}

function buildQuery<T extends object>(params?: T) {
  if (!params) {
    return "";
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, string | undefined>)) {
    if (value && value.trim()) {
      search.set(key, value.trim());
    }
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
