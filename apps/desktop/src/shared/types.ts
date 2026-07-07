export type StaffRole = "admin" | "manager" | "employee" | string;

export type AuthTokenPayload = {
  userId: number;
  role: StaffRole;
  departmentId: number | null;
};

export type SetupTokenResponse = {
  token: string;
  expiresAt: string;
};

export type ActivityEvent =
  | "activity"
  | "lock"
  | "unlock"
  | "away_start"
  | "away_end";
