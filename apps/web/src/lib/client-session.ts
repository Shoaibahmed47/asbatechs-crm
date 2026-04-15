import { cookies } from "next/headers";
import { CLIENT_COOKIE_NAME, verifyClientToken } from "@/lib/auth-client";

export async function getClientSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CLIENT_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyClientToken(token);
}
