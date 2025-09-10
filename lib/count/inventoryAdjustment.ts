// lib/count/inventoryAdjustment.ts
import { productAddToInventory } from "@/lib/inventory/inventoryApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { type CountComparisonItem } from "./countApi";

export interface AdjustmentResult {
  variant_id: string;
  sku: string | null;
  product_name: string | null;
  variant_name: string | null;
  delta: number;
  status: "success" | "error";
  message?: string;
}

/**
 * Apply inventory adjustments based on count comparison results
 */
export async function applyCountAdjustments(
  store_id: string,
  comparisonResults: CountComparisonItem[]
): Promise<AdjustmentResult[]> {
  const token = await getAccessToken();
  const results: AdjustmentResult[] = [];

  // Filter out items that match (no adjustment needed)
  const itemsToAdjust = comparisonResults.filter(
    (item) => item.status !== "MATCH"
  );

  for (const item of itemsToAdjust) {
    try {
      // Use the inventory API to adjust quantities
      // Note: delta can be positive (add) or negative (subtract)
      await productAddToInventory(token, {
        variant_id: item.variant_id,
        store_id: store_id,
        delta: item.delta, // Can be positive or negative
        reason: "COUNT",
        note: `Count adjustment: ${item.status} (Delta: ${item.delta})`,
      });

      results.push({
        variant_id: item.variant_id,
        sku: item.sku,
        product_name: item.product_name,
        variant_name: item.variant_name,
        delta: item.delta,
        status: "success",
      });
    } catch (error) {
      console.error(
        `Failed to adjust inventory for ${item.variant_id}:`,
        error
      );

      results.push({
        variant_id: item.variant_id,
        sku: item.sku,
        product_name: item.product_name,
        variant_name: item.variant_name,
        delta: item.delta,
        status: "error",
        message: (error as Error).message,
      });
    }
  }

  return results;
}

/**
 * Batch apply adjustments with progress callback
 */
export async function applyCountAdjustmentsWithProgress(
  store_id: string,
  comparisonResults: CountComparisonItem[],
  onProgress?: (
    current: number,
    total: number,
    item?: CountComparisonItem
  ) => void
): Promise<AdjustmentResult[]> {
  const results: AdjustmentResult[] = [];
  const itemsToAdjust = comparisonResults.filter(
    (item) => item.status !== "MATCH"
  );
  const total = itemsToAdjust.length;

  for (let i = 0; i < itemsToAdjust.length; i++) {
    const item = itemsToAdjust[i];

    // Call progress callback
    onProgress?.(i + 1, total, item);

    try {
      const token = await getAccessToken();

      await productAddToInventory(token, {
        variant_id: item.variant_id,
        store_id: store_id,
        delta: item.delta,
        reason: "COUNT",
        note: `Count adjustment: ${item.status} (Delta: ${item.delta})`,
      });

      results.push({
        variant_id: item.variant_id,
        sku: item.sku,
        product_name: item.product_name,
        variant_name: item.variant_name,
        delta: item.delta,
        status: "success",
      });
    } catch (error) {
      console.error(
        `Failed to adjust inventory for ${item.variant_id}:`,
        error
      );

      results.push({
        variant_id: item.variant_id,
        sku: item.sku,
        product_name: item.product_name,
        variant_name: item.variant_name,
        delta: item.delta,
        status: "error",
        message: (error as Error).message,
      });
    }

    // Small delay to avoid overwhelming the API
    if (i < itemsToAdjust.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Validate adjustments before applying
 */
export function validateAdjustments(comparisonResults: CountComparisonItem[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for missing variant IDs
  const missingIds = comparisonResults.filter((item) => !item.variant_id);
  if (missingIds.length > 0) {
    issues.push(`${missingIds.length} items missing variant IDs`);
  }

  // Check for extreme differences (might indicate data issues)
  const extremeDifferences = comparisonResults.filter(
    (item) => Math.abs(item.delta) > 1000
  );
  if (extremeDifferences.length > 0) {
    issues.push(
      `${extremeDifferences.length} items with extreme differences (>1000)`
    );
  }

  // Check for negative physical quantities
  const negativeQty = comparisonResults.filter((item) => item.physical_qty < 0);
  if (negativeQty.length > 0) {
    issues.push(
      `${negativeQty.length} items with negative physical quantities`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Get summary statistics for adjustments
 */
export function getAdjustmentSummary(comparisonResults: CountComparisonItem[]) {
  const itemsToAdjust = comparisonResults.filter(
    (item) => item.status !== "MATCH"
  );

  const additions = itemsToAdjust.filter((item) => item.delta > 0);
  const subtractions = itemsToAdjust.filter((item) => item.delta < 0);

  const totalAdditions = additions.reduce((sum, item) => sum + item.delta, 0);
  const totalSubtractions = Math.abs(
    subtractions.reduce((sum, item) => sum + item.delta, 0)
  );

  return {
    totalItems: itemsToAdjust.length,
    additions: {
      count: additions.length,
      total: totalAdditions,
    },
    subtractions: {
      count: subtractions.length,
      total: totalSubtractions,
    },
    netChange: totalAdditions - totalSubtractions,
  };
}
