import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
const JWT_EXPIRES_IN = "14d";

export const CLIENT_COOKIE_NAME = "crm_client_token";

export type ClientTokenPayload = {
  clientId: number;
  email: string;
};

export async function signClientToken(payload: ClientTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

export async function verifyClientToken(token: string): Promise<ClientTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const clientId = payload.clientId;
    const email = payload.email;
    if (typeof clientId !== "number" || typeof email !== "string") return null;
    return { clientId, email };
  } catch {
    return null;
  }
}
