import { ApiError } from "@adeyapp/api-client";
import type {
  AttendancePayload,
  CreateAppointmentPayload,
  CreateCustomerPayload
} from "@adeyapp/api-client";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { tenantApi } from "./api";

const storageKey = "adeyapp.tenant.offlineQueue";
const nativeQueueFileUri = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}adeyapp-offline-queue.json`
  : null;

let memoryQueue: OfflineQueueAction[] = [];
let hydratedQueue = false;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface OfflineQueueScope {
  tenantId: string;
  userId: string;
}

type QueuedAppointmentPayload = Omit<CreateAppointmentPayload, "customerId"> & {
  customerId?: string;
  customerDraft?: {
    fullName: string;
    phone?: string;
    email?: string;
    notes?: string;
    marketingConsent?: boolean;
  };
};

interface OfflineQueueBase {
  id: string;
  tenantId: string;
  userId: string;
  branchId?: string;
  createdAt: string;
}

type OfflineQueueAction =
  | (OfflineQueueBase & {
      kind: "employee.checkIn";
      payload: AttendancePayload;
    })
  | (OfflineQueueBase & {
      kind: "employee.checkOut";
      payload: AttendancePayload;
    })
  | (OfflineQueueBase & {
      kind: "reception.createCustomer";
      payload: CreateCustomerPayload;
    })
  | (OfflineQueueBase & {
      kind: "reception.createAppointment";
      payload: QueuedAppointmentPayload;
    });

export interface OfflineQueueSnapshotItem {
  id: string;
  tenantId: string;
  userId: string;
  branchId?: string;
  kind: OfflineQueueAction["kind"];
  createdAt: string;
  label: string;
}

export interface OfflineQueueFlushResult {
  processedCount: number;
  remainingCount: number;
  processedLabels: string[];
  failedLabels: string[];
}

export async function enqueueOfflineAction(
  action: Omit<OfflineQueueAction, "id" | "createdAt">
): Promise<OfflineQueueSnapshotItem> {
  const queue = await loadQueue();
  const nextAction: OfflineQueueAction = {
    ...(action as OfflineQueueAction),
    id: createQueueId(),
    createdAt: new Date().toISOString()
  };

  await persistQueue([...queue, nextAction]);
  return toSnapshotItem(nextAction);
}

export async function getOfflineQueueSnapshot(scope?: OfflineQueueScope): Promise<OfflineQueueSnapshotItem[]> {
  return (await loadQueue())
    .filter((item) => matchesScope(item, scope))
    .map(toSnapshotItem);
}

export async function getOfflineQueueCount(scope?: OfflineQueueScope): Promise<number> {
  return (await loadQueue()).filter((item) => matchesScope(item, scope)).length;
}

export async function flushOfflineQueue(scope?: OfflineQueueScope): Promise<OfflineQueueFlushResult> {
  const queue = await loadQueue();
  const remaining: OfflineQueueAction[] = [];
  const processedLabels: string[] = [];
  const failedLabels: string[] = [];

  for (const action of queue) {
    if (!matchesScope(action, scope)) {
      remaining.push(action);
      continue;
    }

    try {
      await executeAction(action);
      processedLabels.push(labelForAction(action));
    } catch {
      remaining.push(action);
      failedLabels.push(labelForAction(action));
    }
  }

  await persistQueue(remaining);

  return {
    processedCount: processedLabels.length,
    remainingCount: remaining.filter((item) => matchesScope(item, scope)).length,
    processedLabels,
    failedLabels
  };
}

export function shouldQueueOffline(issue: unknown) {
  return !(issue instanceof ApiError);
}

export function isOfflineCustomerId(value: string) {
  return value.startsWith("offline-customer:");
}

export function createOfflineCustomerId() {
  return `offline-customer:${createQueueId()}`;
}

async function executeAction(action: OfflineQueueAction) {
  switch (action.kind) {
    case "employee.checkIn":
      await tenantApi.employee.checkIn(action.payload);
      return;
    case "employee.checkOut":
      await tenantApi.employee.checkOut(action.payload);
      return;
    case "reception.createCustomer":
      await tenantApi.reception.createCustomer(action.payload);
      return;
    case "reception.createAppointment": {
      const { customerDraft, customerId: queuedCustomerId, ...appointmentPayload } = action.payload;
      let customerId = queuedCustomerId;

      if (!customerId && customerDraft) {
        const createdCustomer = await tenantApi.reception.createCustomer({
          branchId: appointmentPayload.branchId,
          fullName: customerDraft.fullName,
          phone: customerDraft.phone,
          email: customerDraft.email,
          notes: customerDraft.notes,
          marketingConsent: customerDraft.marketingConsent
        });
        customerId = createdCustomer.id;
      }

      if (!customerId) {
        throw new Error("Queued appointment is missing a customer reference.");
      }

      await tenantApi.reception.createAppointment({
        ...appointmentPayload,
        customerId
      });
    }
  }
}

function matchesScope(action: OfflineQueueAction, scope?: OfflineQueueScope) {
  if (!scope) {
    return true;
  }

  return action.tenantId === scope.tenantId && action.userId === scope.userId;
}

function toSnapshotItem(action: OfflineQueueAction): OfflineQueueSnapshotItem {
  return {
    id: action.id,
    tenantId: action.tenantId,
    userId: action.userId,
    branchId: action.branchId,
    kind: action.kind,
    createdAt: action.createdAt,
    label: labelForAction(action)
  };
}

function labelForAction(action: OfflineQueueAction) {
  switch (action.kind) {
    case "employee.checkIn":
      return "Attendance check-in";
    case "employee.checkOut":
      return "Attendance check-out";
    case "reception.createCustomer":
      return `Customer ${action.payload.fullName}`;
    case "reception.createAppointment":
      return `Booking for ${action.payload.startAt}`;
  }
}

async function loadQueue(): Promise<OfflineQueueAction[]> {
  if (hydratedQueue) {
    return memoryQueue;
  }

  const storedQueue = await readStoredQueue();
  memoryQueue = storedQueue ?? [];
  hydratedQueue = true;
  return memoryQueue;
}

async function persistQueue(queue: OfflineQueueAction[]) {
  memoryQueue = queue;
  hydratedQueue = true;
  await writeStoredQueue(queue);
}

async function readStoredQueue(): Promise<OfflineQueueAction[] | null> {
  if (Platform.OS === "web") {
    return readWebStoredQueue();
  }

  if (!nativeQueueFileUri) {
    return null;
  }

  try {
    const info = await FileSystem.getInfoAsync(nativeQueueFileUri);
    if (!info.exists) {
      return [];
    }

    const raw = await FileSystem.readAsStringAsync(nativeQueueFileUri);
    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as OfflineQueueAction[];
  } catch {
    return [];
  }
}

async function writeStoredQueue(queue: OfflineQueueAction[]) {
  if (Platform.OS === "web") {
    writeWebStoredQueue(queue);
    return;
  }

  if (!nativeQueueFileUri) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(nativeQueueFileUri, JSON.stringify(queue));
  } catch {
    // Keep the in-memory queue intact even if native file persistence fails.
  }
}

function readWebStoredQueue(): OfflineQueueAction[] | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(storageKey);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as OfflineQueueAction[];
  } catch {
    return [];
  }
}

function writeWebStoredQueue(queue: OfflineQueueAction[]) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(storageKey, JSON.stringify(queue));
}

function getStorage(): StorageLike | null {
  const runtime = globalThis as { localStorage?: StorageLike };
  return runtime.localStorage ?? null;
}

function createQueueId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
