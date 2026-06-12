import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? "587");
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!host || !user || !pass) {
  console.warn("SMTP environment variables are not fully set. Invitation emails may fail.");
}

const transporter =
  host && user && pass
    ? nodemailer.createTransport({
        host,
        port,
        secure: false,
        auth: { user, pass }
      })
    : null;

export async function sendInviteEmail(to: string, signupUrl: string) {
  if (!transporter) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in apps/web/.env, then restart the dev server."
    );
  }

  await transporter.sendMail({
    from: `"AsbaTechs CRM" <${user}>`,
    to,
    subject: "Your AsbaTechs CRM invitation",
    text: `You have been invited to AsbaTechs CRM. Sign up here: ${signupUrl}`,
    html: `<p>You have been invited to <strong>AsbaTechs CRM</strong>.</p>
           <p><a href="${signupUrl}">Click here to complete your signup</a>.</p>`
  });
}

export async function sendClientInviteEmail(to: string, signupUrl: string) {
  if (!transporter) return;

  await transporter.sendMail({
    from: `"AsbaTechs CRM" <${user}>`,
    to,
    subject: "Your client portal invitation — AsbaTechs CRM",
    text: `You have been invited to the AsbaTechs client portal. Complete signup: ${signupUrl}`,
    html: `<p>You have been invited to the <strong>AsbaTechs client portal</strong>.</p>
           <p><a href="${signupUrl}">Create your password and access your dashboard</a>.</p>
           <p style="color:#64748b;font-size:12px">If you did not expect this, you can ignore this email.</p>`
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!transporter) return;

  await transporter.sendMail({
    from: `"AsbaTechs CRM" <${user}>`,
    to,
    subject: "Reset your AsbaTechs CRM password",
    text: `Reset your password here: ${resetUrl}`,
    html: `<p>We received a request to reset your password for <strong>AsbaTechs CRM</strong>.</p>
           <p><a href="${resetUrl}">Click here to choose a new password</a>.</p>
           <p style="color:#64748b;font-size:12px">If you did not request this, you can ignore this email.</p>`
  });
}


