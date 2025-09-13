// Receipt API functions with proper encoding handling
export async function generateReturnReceipt(
  tenant_id: string,
  return_id: string,
  token: string,
  format: "pdf" | "json" = "pdf",
  download: boolean = false
) {
  try {
    const url = new URL(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt`
    );

    url.searchParams.set("tenant_id", tenant_id);
    url.searchParams.set("kind", "return");
    url.searchParams.set("id", return_id);
    url.searchParams.set("format", format);
    url.searchParams.set("download", download.toString());
    // Try MNT first
    url.searchParams.set("currency", "MNT");
    url.searchParams.set("title", "RETURN RECEIPT");
    url.searchParams.set("footer", "Thank you!");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // If it's an encoding error, retry with USD currency
      if (
        errorData.error?.includes("WinAnsi cannot encode") ||
        errorData.error?.includes("₮")
      ) {
        return generateReturnReceiptFallback(
          tenant_id,
          return_id,
          token,
          format,
          download
        );
      }

      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    if (format === "json") {
      return await response.json();
    }

    return await response.blob();
  } catch (error: any) {
    // If encoding error occurs, try fallback
    if (
      error.message?.includes("WinAnsi cannot encode") ||
      error.message?.includes("₮")
    ) {
      return generateReturnReceiptFallback(
        tenant_id,
        return_id,
        token,
        format,
        download
      );
    }
    throw error;
  }
}

// Fallback function using USD currency to avoid encoding issues
async function generateReturnReceiptFallback(
  tenant_id: string,
  return_id: string,
  token: string,
  format: "pdf" | "json" = "pdf",
  download: boolean = false
) {
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt`
  );

  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("kind", "return");
  url.searchParams.set("id", return_id);
  url.searchParams.set("format", format);
  url.searchParams.set("download", download.toString());
  // Use USD to avoid WinAnsi encoding issues
  url.searchParams.set("currency", "USD");
  url.searchParams.set("title", "RETURN RECEIPT");
  url.searchParams.set("footer", "Thank you!");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  if (format === "json") {
    return await response.json();
  }

  return await response.blob();
}

export async function generateOrderReceipt(
  tenant_id: string,
  order_id: string,
  token: string,
  format: "pdf" | "json" = "pdf",
  download: boolean = false
) {
  try {
    const url = new URL(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt`
    );

    url.searchParams.set("tenant_id", tenant_id);
    url.searchParams.set("kind", "order");
    url.searchParams.set("id", order_id);
    url.searchParams.set("format", format);
    url.searchParams.set("download", download.toString());
    // Try MNT first
    url.searchParams.set("currency", "MNT");
    url.searchParams.set("title", "SALES RECEIPT");
    url.searchParams.set("footer", "Thank you!");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // If it's an encoding error, retry with USD currency
      if (
        errorData.error?.includes("WinAnsi cannot encode") ||
        errorData.error?.includes("₮")
      ) {
        return generateOrderReceiptFallback(
          tenant_id,
          order_id,
          token,
          format,
          download
        );
      }

      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    if (format === "json") {
      return await response.json();
    }

    return await response.blob();
  } catch (error: any) {
    // If encoding error occurs, try fallback
    if (
      error.message?.includes("WinAnsi cannot encode") ||
      error.message?.includes("₮")
    ) {
      return generateOrderReceiptFallback(
        tenant_id,
        order_id,
        token,
        format,
        download
      );
    }
    throw error;
  }
}

// Fallback function for order receipts
async function generateOrderReceiptFallback(
  tenant_id: string,
  order_id: string,
  token: string,
  format: "pdf" | "json" = "pdf",
  download: boolean = false
) {
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt`
  );

  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("kind", "order");
  url.searchParams.set("id", order_id);
  url.searchParams.set("format", format);
  url.searchParams.set("download", download.toString());
  // Use USD to avoid WinAnsi encoding issues
  url.searchParams.set("currency", "USD");
  url.searchParams.set("title", "SALES RECEIPT");
  url.searchParams.set("footer", "Thank you!");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  if (format === "json") {
    return await response.json();
  }

  return await response.blob();
}
