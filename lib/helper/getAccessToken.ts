import { supabase } from "../supabaseClient";

export async function getAccessToken(): Promise<string> {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Session error:", error);
      throw new Error("AUTHENTICATION_ERROR");
    }

    if (!session?.access_token) {
      console.warn("No access token found in session");
      throw new Error("NOT_AUTHENTICATED");
    }

    // Validate token format (JWT should have 3 parts separated by dots)
    const tokenParts = session.access_token.split(".");
    if (tokenParts.length !== 3) {
      console.error(
        "Invalid token format - expected 3 parts, got:",
        tokenParts.length
      );
      throw new Error("INVALID_TOKEN_FORMAT");
    }

    return session.access_token;
  } catch (error) {
    console.error("Error getting access token:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("TOKEN_RETRIEVAL_FAILED");
  }
}
