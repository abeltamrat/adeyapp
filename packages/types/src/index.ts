export type RoleType =
  | "owner"
  | "manager"
  | "receptionist"
  | "employee"
  | "customer"
  | "superadmin"
  | "superadmin_support"
  | "superadmin_finance";

export type AppointmentStatus =
  | "draft"
  | "confirmed"
  | "checked_in"
  | "in_service"
  | "completed"
  | "canceled"
  | "no_show";

export type WaitlistStatus = "waiting" | "contacted" | "promoted" | "closed";
export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "canceled";
export type CreditRequestStatus = "pending" | "approved" | "rejected" | "settled";
export type PayrollBatchStatus = "draft" | "finalized" | "paid";
export type SupplierStatus = "active" | "inactive";
export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "canceled";

export type AttendanceStatus = "present" | "late" | "absent" | "partial" | "flagged";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "grace_period"
  | "suspended"
  | "canceled";

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_on_customer"
  | "resolved"
  | "closed";

export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export interface TenantContext {
  tenantId: string;
  branchId?: string;
  employeeId?: string;
  role: RoleType;
}

export interface TenantMembershipSummary {
  id: string;
  name: string;
  slug: string;
  role: RoleType;
  branchIds: string[];
}

export interface SessionUser {
  id: string;
  email: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  context?: TenantContext;
  tenants: TenantMembershipSummary[];
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}

export interface BranchSummary {
  id: string;
  name: string;
  code: string;
  timezone: string;
  isDefault: boolean;
}

export interface CustomerSummary {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  primaryBranchId?: string | null;
  marketingConsent: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface CustomerAccountProfile {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  primaryBranchId?: string | null;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  preferences?: Record<string, unknown> | null;
  notes?: string | null;
  marketingConsent: boolean;
  createdAt: string;
}

export interface EmployeeSummary {
  id: string;
  userId: string;
  email: string;
  phone?: string | null;
  employeeCode: string;
  roleType: "manager" | "receptionist" | "employee";
  primaryBranchId: string;
  employmentStatus:
    | "invited"
    | "active"
    | "suspended_paid"
    | "suspended_unpaid"
    | "terminated";
  creditEligible: boolean;
  canEarnCommission: boolean;
  createdAt: string;
}

export interface InventoryItemSummary {
  id: string;
  productId: string;
  quantityOnHand: string;
  reorderLevel?: string | null;
  status: "active" | "inactive";
  lastCountedAt?: string | null;
  updatedAt?: string | null;
}

export interface ProductSummary {
  id: string;
  branchId: string;
  name: string;
  sku: string;
  description?: string | null;
  unitPrice: string;
  costPrice?: string | null;
  status: "active" | "inactive";
  isRetail: boolean;
  inventoryItem?: InventoryItemSummary | null;
}

export interface PublicWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
}

export interface PublicCatalogRoomSummary {
  id: string;
  name: string;
  code: string;
  roomType?: string | null;
}

export interface PublicCatalogServiceSummary {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  durationMinutes: number;
  price: string;
  requiresRoom: boolean;
}

export interface PublicCatalogBranchSummary {
  id: string;
  name: string;
  code: string;
  timezone: string;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  rooms: PublicCatalogRoomSummary[];
  services: PublicCatalogServiceSummary[];
}

export interface PublicCatalogSummary {
  tenant: PublicWorkspaceSummary;
  branches: PublicCatalogBranchSummary[];
}

export interface SuperadminDashboardSummary {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  trialTenants: number;
  pastDueSubscriptions: number;
  openSupportTickets: number;
}

export interface SuperadminTenantSummary {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "trial" | "active" | "grace_period" | "suspended" | "archived";
  timezone: string;
  currency: string;
  country: string;
  trialEndsAt?: string | null;
  activatedAt?: string | null;
  suspendedAt?: string | null;
  branchCount: number;
  employeeCount: number;
  appointmentCount: number;
  ownerEmail?: string | null;
  currentPlanCode?: string | null;
  subscriptionStatus?: SubscriptionStatus | null;
  renewsAt?: string | null;
  graceEndsAt?: string | null;
  createdAt: string;
}

export interface SuperadminTenantDetail extends SuperadminTenantSummary {
  moduleEntitlements: TenantModuleEntitlements;
  latestInvoice?: {
    id: string;
    invoiceNumber: string;
    status: "draft" | "issued" | "paid" | "void" | "overdue";
    totalAmount: string;
    dueAt?: string | null;
    issuedAt?: string | null;
  } | null;
  latestPayment?: {
    id: string;
    paymentMethod: string;
    amount: string;
    status: "pending" | "succeeded" | "failed";
    providerReference?: string | null;
    paidAt?: string | null;
  } | null;
}

export interface TenantModuleEntitlements {
  inventory: boolean;
  employeeCredit: boolean;
  notifications: boolean;
  customerAccounts: boolean;
}

export interface SuperadminAuditEntrySummary {
  id: string;
  tenantId: string;
  tenantName: string;
  branchId?: string | null;
  branchName?: string | null;
  actorUserId: string;
  actorEmail?: string | null;
  actionKey: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface SuperadminTenantUsageSummary {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: "draft" | "trial" | "active" | "grace_period" | "suspended" | "archived";
  branchCount: number;
  serviceCount: number;
  productCount: number;
  activeEmployeeCount: number;
  customerCount: number;
  appointmentCount30d: number;
  completedAppointmentCount30d: number;
  unreadNotificationCount: number;
  openSupportTicketCount: number;
  latestAuditAt?: string | null;
  latestPaymentAt?: string | null;
}

export interface SupportTicketSummary {
  id: string;
  tenantId: string;
  tenantName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  requesterUserId: string;
  requesterEmail?: string | null;
  assignedToUserId?: string | null;
  assignedToEmail?: string | null;
  subject: string;
  body: string;
  category: string;
  channel: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  internalNote?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSummary {
  id: string;
  tenantId: string;
  branchId?: string | null;
  userId: string;
  type: string;
  title: string;
  body: string;
  status: "unread" | "read" | "archived";
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

export interface TenantBillingSummary {
  tenantId: string;
  tenantName: string;
  tenantStatus: "draft" | "trial" | "active" | "grace_period" | "suspended" | "archived";
  currency: string;
  currentPlanCode?: string | null;
  subscriptionStatus?: SubscriptionStatus | null;
  trialEndsAt?: string | null;
  renewsAt?: string | null;
  graceEndsAt?: string | null;
  latestInvoice?: {
    id: string;
    invoiceNumber: string;
    status: "draft" | "issued" | "paid" | "void" | "overdue";
    totalAmount: string;
    dueAt?: string | null;
    issuedAt?: string | null;
  } | null;
  latestPayment?: {
    id: string;
    paymentMethod: string;
    amount: string;
    status: "pending" | "succeeded" | "failed";
    providerReference?: string | null;
    paidAt?: string | null;
  } | null;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    status: "draft" | "issued" | "paid" | "void" | "overdue";
    totalAmount: string;
    dueAt?: string | null;
    issuedAt?: string | null;
    createdAt: string;
  }>;
  recentPayments: Array<{
    id: string;
    invoiceId: string;
    invoiceNumber?: string | null;
    paymentMethod: string;
    amount: string;
    status: "pending" | "succeeded" | "failed";
    providerReference?: string | null;
    paidAt?: string | null;
    createdAt: string;
  }>;
}

export interface ShiftTemplateSummary {
  id: string;
  branchId: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  createdAt: string;
}

export interface ShiftAssignmentSummary {
  id: string;
  branchId: string;
  employeeId: string;
  employeeEmail?: string | null;
  employeeCode?: string | null;
  shiftTemplateId: string;
  shiftTemplateName: string;
  shiftTemplateCode: string;
  shiftDate: string;
  startAt: string;
  endAt: string;
  gracePeriodMinutes: number;
  createdAt: string;
}

export interface AttendanceSummary {
  id: string;
  branchId: string;
  employeeId: string;
  employeeEmail?: string | null;
  employeeCode?: string | null;
  shiftAssignmentId?: string | null;
  shiftTemplateName?: string | null;
  attendanceStatus: AttendanceStatus;
  networkIdentifier?: string | null;
  gpsLatitude?: string | null;
  gpsLongitude?: string | null;
  latenessMinutes: number;
  exceptionFlag: boolean;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  createdAt: string;
}

export interface AttendancePayrollSummary {
  employeeId: string;
  employeeEmail?: string | null;
  employeeCode?: string | null;
  branchId: string;
  totalSessions: number;
  completedSessions: number;
  openSessions: number;
  totalWorkedMinutes: number;
  totalWorkedHours: string;
  totalLatenessMinutes: number;
  lateSessions: number;
  absentSessions: number;
  flaggedSessions: number;
  exceptionCount: number;
}

export interface AttendanceCorrectionSummary {
  id: string;
  attendanceId: string;
  branchId?: string | null;
  employeeId?: string | null;
  employeeEmail?: string | null;
  employeeCode?: string | null;
  actorUserId: string;
  actorEmail?: string | null;
  fromStatus?: AttendanceStatus | null;
  toStatus?: AttendanceStatus | null;
  fromLatenessMinutes: number;
  toLatenessMinutes: number;
  fromExceptionFlag: boolean;
  toExceptionFlag: boolean;
  note?: string | null;
  createdAt: string;
}

export interface AttendancePayrollSnapshotSummary {
  id: string;
  branchId?: string | null;
  actorUserId: string;
  actorEmail?: string | null;
  fromDate: string;
  toDate: string;
  employeeCount: number;
  totalWorkedMinutes: number;
  totalWorkedHours: string;
  totalLatenessMinutes: number;
  totalExceptions: number;
  note?: string | null;
  createdAt: string;
}

export interface OperationPolicySummary {
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

export interface PolicyAcknowledgementSummary {
  enabled: boolean;
  version: string;
  title: string;
  body: string;
  requiredRoles: Array<"manager" | "receptionist" | "employee">;
  acknowledged: boolean;
  acknowledgedAt?: string | null;
}

export interface BranchBookingPolicySummary {
  branchId: string;
  bookingCancellationWindowHours: number;
  bookingLeadTimeMinutes: number;
  cleanupBufferMinutes: number;
  useWorkspaceCancellationWindow: boolean;
  useWorkspaceLeadTime: boolean;
  useWorkspaceCleanupBuffer: boolean;
}

export interface AppointmentLineSummary {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  durationMinutes: number;
  unitPrice: string;
  status: AppointmentStatus;
}

export interface AppointmentSummary {
  id: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerName: string;
  customerFullName: string;
  customerPhone?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  employeeId?: string | null;
  employeeEmail?: string | null;
  employeeCode?: string | null;
  serviceName: string;
  status: AppointmentStatus;
  source: "customer_app" | "reception" | "manager" | "owner";
  notes?: string | null;
  startAt: string;
  endAt: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  createdAt: string;
  lines: AppointmentLineSummary[];
}

export interface WaitlistEntrySummary {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  status: WaitlistStatus;
  preferredStartAt?: string | null;
  note?: string | null;
  contactedAt?: string | null;
  promotedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
}

export interface OperationsReportSummary {
  branchId?: string | null;
  fromDate: string;
  toDate: string;
  totals: {
    completedRevenue: string;
    completedAppointments: number;
    createdAppointments: number;
    activeCustomers: number;
    totalInventoryItems: number;
    lowStockItems: number;
    outOfStockItems: number;
  };
  revenueByBranch: Array<{
    branchId: string;
    branchName: string;
    completedRevenue: string;
    completedAppointments: number;
  }>;
  appointmentVolumeByDay: Array<{
    date: string;
    createdAppointments: number;
    completedAppointments: number;
    canceledAppointments: number;
    noShowAppointments: number;
  }>;
  inventoryByBranch: Array<{
    branchId: string;
    branchName: string;
    totalItems: number;
    lowStockItems: number;
    outOfStockItems: number;
  }>;
}

export interface LeaveTypeSummary {
  id: string;
  tenantId: string;
  branchId?: string | null;
  name: string;
  code: string;
  isPaid: boolean;
  defaultBalanceDays: string;
  requiresDocument: boolean;
  createdAt: string;
}

export interface LeaveBalanceSummary {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeCode?: string | null;
  employeeEmail?: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  balanceDays: string;
  usedDays: string;
  carriedOverDays: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequestSummary {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string | null;
  employeeId: string;
  employeeCode?: string | null;
  employeeEmail?: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  dayCount: string;
  status: LeaveRequestStatus;
  reason?: string | null;
  managerNote?: string | null;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  branchImpact: {
    activeEmployees: number;
    employeesAlreadyOff: number;
    availableEmployeesAfterApproval: number;
  };
  createdAt: string;
}

export interface CreditRequestSummary {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string | null;
  employeeId: string;
  employeeCode?: string | null;
  employeeEmail?: string | null;
  amount: string;
  approvedAmount?: string | null;
  repaidAmount: string;
  outstandingAmount: string;
  status: CreditRequestStatus;
  reason?: string | null;
  ownerNote?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  settledAt?: string | null;
  createdAt: string;
}

export interface PayrollBatchItemSummary {
  id: string;
  employeeId: string;
  employeeCode?: string | null;
  employeeEmail?: string | null;
  workedMinutes: number;
  lateMinutes: number;
  grossAmount: string;
  deductionsAmount: string;
  creditDeductionAmount: string;
  netAmount: string;
  note?: string | null;
}

export interface PayrollBatchSummary {
  id: string;
  tenantId: string;
  branchId?: string | null;
  branchName?: string | null;
  actorUserId: string;
  fromDate: string;
  toDate: string;
  hourlyRate: string;
  latePenaltyPerMinute: string;
  includeCreditDeductions: boolean;
  status: PayrollBatchStatus;
  note?: string | null;
  createdAt: string;
  totals: {
    grossAmount: string;
    deductionsAmount: string;
    creditDeductionAmount: string;
    netAmount: string;
  };
  items: PayrollBatchItemSummary[];
}

export interface SupplierSummary {
  id: string;
  tenantId: string;
  branchId?: string | null;
  branchName?: string | null;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status: SupplierStatus;
  createdAt: string;
}

export interface PurchaseOrderItemSummary {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantityOrdered: string;
  quantityReceived: string;
  unitCost: string;
}

export interface PurchaseOrderSummary {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string | null;
  supplierId: string;
  supplierName: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  note?: string | null;
  orderedAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  items: PurchaseOrderItemSummary[];
}
