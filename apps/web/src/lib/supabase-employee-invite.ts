import { createSupabaseAdminClient } from "@/lib/supabase";
import { sendInviteEmail } from "@/lib/mail";

export type EmployeeInviteMetadata = {
  firstName?: string;
  lastName?: string;
  departmentId?: number | null;
  invitedByUserId?: number;
};

function isFallbackInviteError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already been registered") ||
    normalized.includes("already registered") ||
    normalized.includes("user already") ||
    normalized.includes("email_exists")
  );
}

export function normalizeEmployeeInviteMetadata(metadata: EmployeeInviteMetadata) {
  return {
    ...(metadata.firstName ? { firstName: metadata.firstName.trim() } : {}),
    ...(metadata.lastName ? { lastName: metadata.lastName.trim() } : {}),
    ...(typeof metadata.departmentId === "number" ? { departmentId: metadata.departmentId } : {}),
    ...(typeof metadata.invitedByUserId === "number"
      ? { invitedByUserId: metadata.invitedByUserId }
      : {})
  };
}

export async function sendEmployeeInvite({
  email,
  redirectTo,
  metadata,
  resend = false,
  invitationToken
}: {
  email: string;
  redirectTo: string;
  metadata: EmployeeInviteMetadata;
  resend?: boolean;
  invitationToken?: string;
}) {
  const admin = createSupabaseAdminClient();
  const normalizedMetadata = normalizeEmployeeInviteMetadata(metadata);
  const isLocalRedirect =
    redirectTo.includes("localhost") || redirectTo.includes("127.0.0.1");

  // For local development, always use generated-link + SMTP flow so the
  // email consistently carries your local redirect target.
  if (isLocalRedirect && invitationToken) {
    const normalizedBase = redirectTo.endsWith("/")
      ? redirectTo.slice(0, -1)
      : redirectTo;
    await sendInviteEmail(email, `${normalizedBase}/${invitationToken}`);
    return { delivery: "smtp" as const };
  }

  // For local development without a legacy token, fallback to generated-link.
  if (!resend && !isLocalRedirect) {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: normalizedMetadata,
      redirectTo
    });

    if (!error) {
      return { delivery: "supabase" as const };
    }

    if (!isFallbackInviteError(error.message)) {
      throw error;
    }
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: normalizedMetadata,
      redirectTo
    }
  });

  if (error) {
    throw error;
  }

  await sendInviteEmail(email, data.properties.action_link);
  return { delivery: "smtp" as const };
}
