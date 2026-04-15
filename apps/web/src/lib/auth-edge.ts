import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export const COOKIE_NAME = "crm_token";
export const CLIENT_COOKIE_NAME = "crm_client_token";

export type AuthEdgeTokenPayload = {
  userId: number;
  role: string;
  departmentId: number | null;
};

export type ClientTokenEdgePayload = {
  clientId: number;
  email: string;
};

export async function verifyAuthTokenEdge(
  token: string
): Promise<AuthEdgeTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (
      typeof payload.userId !== "number" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      role: payload.role,
      departmentId:
        typeof payload.departmentId === "number" ? payload.departmentId : null
    };
  } catch {
    return null;
  }
}

export async function verifyClientTokenEdge(
  token: string
): Promise<ClientTokenEdgePayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (typeof payload.clientId !== "number" || typeof payload.email !== "string") {
      return null;
    }
    return { clientId: payload.clientId, email: payload.email };
  } catch {
    return null;
  }
}

