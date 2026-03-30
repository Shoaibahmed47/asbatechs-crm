import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export const COOKIE_NAME = "crm_token";

export type AuthEdgeTokenPayload = {
  userId: number;
  role: string;
  departmentId: number | null;
};

export async function verifyAuthTokenEdge(
  token: string
): Promise<AuthEdgeTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<AuthEdgeTokenPayload>(token, JWT_SECRET);
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

