// lib/transfer/transferApi.ts
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getTenantId } from "@/lib/helper/getTenantId";

const BASE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/transfer`;

// ---------- Types ----------
export type TransferStatus =
  | "REQUESTED"
  | "APPROVED"
  | "SHIPPED"
  | "RECEIVED"
  | "CANCELLED";

export type TransferItem = {
  id?: string;
  variant_id: string;
  qty: number;
};

export type Transfer = {
  id: string;
  tenant_id: string;
  src_store_id: string;
  dst_store_id: string;
  status: TransferStatus;
  note?: string;
  created_by?: string;
  approved_by?: string;
  shipped_by?: string;
  received_by?: string;
  created_at: string;
  approved_at?: string;
  shipped_at?: string;
  received_at?: string;
  shipped_posted?: boolean;
  received_posted?: boolean;
};

export type TransferWithItems = {
  transfer: Transfer;
  items: TransferItem[];
};

export type CreateTransferPayload = {
  tenant_id: string;
  src_store_id: string;
  dst_store_id: string;
  items: Array<{
    variant_id: string;
    qty: number;
  }>;
  note?: string;
  allow_negative?: boolean;
};

export type TransferAction = "approve" | "ship" | "receive" | "cancel";

export type TransferListResponse = {
  items: Transfer[];
  count: number;
  limit: number;
  offset: number;
};

// ---------- API Functions ----------

/**
 * Get list of transfers with optional filters
 */
export async function getTransfers(params?: {
  id?: string;
  status?: TransferStatus;
  src_store_id?: string;
  dst_store_id?: string;
  limit?: number;
  offset?: number;
}): Promise<TransferListResponse | TransferWithItems> {
  const token = await getAccessToken();
  const tenant_id = await getTenantId();

  if (!tenant_id) {
    throw new Error("Tenant ID not found");
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("tenant_id", tenant_id);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value.toString());
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch transfers");
  }

  return response.json();
}

/**
 * Get single transfer with items
 */
export async function getTransferById(id: string): Promise<TransferWithItems> {
  const result = await getTransfers({ id });
  return result as TransferWithItems;
}

/**
 * Create a new transfer
 */
export async function createTransfer(
  payload: Omit<CreateTransferPayload, "tenant_id">
): Promise<{ transfer: Transfer }> {
  const token = await getAccessToken();
  const tenant_id = await getTenantId();

  if (!tenant_id) {
    throw new Error("Tenant ID not found");
  }

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      tenant_id,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create transfer");
  }

  return response.json();
}

/**
 * Update transfer status (approve, ship, receive, cancel)
 */
export async function updateTransferStatus(
  id: string,
  action: TransferAction
): Promise<{ ok: boolean; status: TransferStatus }> {
  const token = await getAccessToken();
  const tenant_id = await getTenantId();

  if (!tenant_id) {
    throw new Error("Tenant ID not found");
  }

  const response = await fetch(BASE_URL, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tenant_id,
      id,
      action,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to ${action} transfer`);
  }

  return response.json();
}

/**
 * Delete a transfer (hard delete, OWNER only)
 */
export async function deleteTransfer(
  id: string
): Promise<{ removed: boolean }> {
  const token = await getAccessToken();
  const tenant_id = await getTenantId();

  if (!tenant_id) {
    throw new Error("Tenant ID not found");
  }

  const response = await fetch(BASE_URL, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tenant_id,
      id,
      confirm: "DELETE",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete transfer");
  }

  return response.json();
}

// ---------- Helper Functions ----------

/**
 * Get transfer status color for UI
 */
export function getTransferStatusColor(status: TransferStatus): string {
  switch (status) {
    case "REQUESTED":
      return "bg-yellow-100 text-yellow-800";
    case "APPROVED":
      return "bg-blue-100 text-blue-800";
    case "SHIPPED":
      return "bg-purple-100 text-purple-800";
    case "RECEIVED":
      return "bg-green-100 text-green-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Get available actions for a transfer based on status
 */
export function getAvailableActions(transfer: Transfer): TransferAction[] {
  const actions: TransferAction[] = [];

  switch (transfer.status) {
    case "REQUESTED":
      actions.push("approve", "cancel");
      break;
    case "APPROVED":
      actions.push("ship", "cancel");
      break;
    case "SHIPPED":
      actions.push("receive");
      break;
    case "RECEIVED":
      // No actions available for completed transfers
      break;
    case "CANCELLED":
      // No actions available for cancelled transfers
      break;
  }

  return actions;
}

/**
 * Format action label for UI
 */
export function getActionLabel(action: TransferAction): string {
  switch (action) {
    case "approve":
      return "Баталгаажуулах";
    case "ship":
      return "Илгээх";
    case "receive":
      return "Хүлээн авах";
    case "cancel":
      return "Цуцлах";
    default:
      return action;
  }
}

/**
 * Format status label for UI
 */
export function getStatusLabel(status: TransferStatus): string {
  switch (status) {
    case "REQUESTED":
      return "Хүсэлт";
    case "APPROVED":
      return "Батлагдсан";
    case "SHIPPED":
      return "Илгээгдсэн";
    case "RECEIVED":
      return "Хүлээн авсан";
    case "CANCELLED":
      return "Цуцлагдсан";
    default:
      return status;
  }
}
