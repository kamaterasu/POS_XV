import { supabase } from "@/lib/supabaseClient";

export type Role = "Admin" | "Manager" | "Cashier" | "OWNER";
// "Admin" | "Manager" | "Cashier";

export async function getUserRole(): Promise<Role | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return null;
    }

    // Get role from app_metadata
    const roles = session.user.app_metadata?.role;

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return "Cashier"; // Default role
    }

    // Get the first role from the array
    const userRole = roles[0];

    // Map OWNER to Admin for UI purposes (since OWNER should have all permissions)
    if (userRole === "OWNER") {
      return "OWNER";
    }

    // Validate role
    if (["Admin", "Manager", "Cashier"].includes(userRole)) {
      return userRole as Role;
    }

    return "Cashier"; // Default fallback
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}

export function canAccessFeature(
  userRole: Role | null,
  feature: string
): boolean {
  if (!userRole) return false;

  switch (feature) {
    case "productReturn":
      return true; // All roles can access product returns
    case "management":
      // Only Admin and OWNER can access management
      return userRole === "Admin" || userRole === "OWNER";
    case "checkout":
      // All roles can access checkout
      return true;
    case "inventory":
      // Inventory count feature - only Admin and OWNER
      return userRole === "Admin" || userRole === "OWNER";
    case "report":
    case "transfer":
      // Only Admin and OWNER can access reports and transfers
      return userRole === "Admin" || userRole === "OWNER";
    case "createProduct":
      // Only Admin, Manager and OWNER can create products - Cashier cannot
      return userRole === "Admin" || userRole === "Manager" || userRole === "OWNER";
    case "createCategory":
      // Only Admin, Manager and OWNER can create categories - Cashier cannot
      return userRole === "Admin" || userRole === "Manager" || userRole === "OWNER";
    default:
      return true;
  }
}
