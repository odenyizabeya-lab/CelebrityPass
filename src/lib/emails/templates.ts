/**
 * Professional, mobile-responsive CelebrityPass HTML email templates.
 *
 * Inline-styled (safe for Gmail/Outlook), dark-branded to match the site,
 * with a gradient wordmark header, a clear call-to-action, and a compliant
 * footer (manage-preferences link on transactional mail, one-click
 * unsubscribe on promotional mail).
 */

type Cta = { label: string; url: string };

import { appUrl } from "@/lib/utils";

const accountPreferencesUrl = `${appUrl()}/account`;

function brandLayout(opts: {
  title: string;
  body: string;
  cta?: Cta;
  unsubscribeUrl?: string;
  footer: string;
}): string {
  const ctaHtml = opts.cta
    ? `
    <tr>
      <td align="center" style="padding:8px 0 0;">
        <a href="${opts.cta.url}" style="display:inline-block;background:linear-gradient(92deg,#7c3aed,#d946ef 55%,#f59e0b 130%);color:#ffffff;font-size:15px;font-weight:700;padding:14px 34px;border-radius:999px;text-decoration:none;">
          ${opts.cta.label}
        </a>
      </td>
    </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
</head>
<body style="margin:0;padding:0;background:#06060a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e4e4e7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06060a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px;">
              <p style="margin:0;font-size:15px;font-weight:800;letter-spacing:0.08em;color:transparent;background:linear-gradient(92deg,#a78bfa,#e879f9 50%,#fbbf24);-webkit-background-clip:text;background-clip:text;">
                ♠️ CELEBRITYPASS
              </p>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#0b0c10;border:1px solid #27272a;border-radius:20px;padding:32px 28px;">
              <h1 style="margin:0 0 16px;font-size:23px;line-height:1.3;font-weight:900;color:#ffffff;">${opts.title}</h1>
              ${opts.body}
              ${ctaHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 8px 0;">
              <p style="margin:0 0 8px;font-size:12px;color:#71717a;">${opts.footer}</p>
              <p style="margin:0;font-size:12px;color:#52525b;">
                CelebrityPass &middot; The world&rsquo;s fan card platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function transactionFooter(): string {
  return (
    `You received this email because you have an account with CelebrityPass. ` +
    `<a href="${accountPreferencesUrl}" style="color:#a78bfa;text-decoration:none;">Manage email preferences</a>.`
  );
}

function promoFooter(unsubscribeUrl: string): string {
  return (
    `You are receiving this because you opted into CelebrityPass updates. ` +
    `<a href="${unsubscribeUrl}" style="color:#a78bfa;text-decoration:none;">Unsubscribe</a> or ` +
    `<a href="${accountPreferencesUrl}" style="color:#a78bfa;text-decoration:none;">manage preferences</a>.`
  );
}

const para = (text: string) =>
  `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#a1a1aa;">${text}</p>`;

const infoCard = (rows: Array<[string, string]>) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#13141b;border:1px solid #27272a;border-radius:14px;margin:0 0 20px;">
    ${rows
      .map(
        ([k, v]) => `<tr>
          <td style="padding:10px 18px;font-size:12px;color:#71717a;white-space:nowrap;text-transform:uppercase;letter-spacing:0.06em;">${k}</td>
          <td style="padding:10px 18px;font-size:14px;font-weight:600;color:#ffffff;text-align:right;">${v}</td>
        </tr>`,
      )
      .join("")}
  </table>`;

const heroCard = (celebrityName: string) =>
  `<div style="background:#13141b;border:1px solid #27272a;border-radius:14px;padding:18px 22px;margin:0 0 20px;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">${celebrityName}</p>
    <p style="margin:2px 0 0;font-size:12px;color:#71717a;">CelebrityPass community</p>
  </div>`;

export type EmailTemplate =
  | { kind: "welcome"; fanName: string; loginUrl: string }
  | { kind: "emailVerification"; fanName: string; verifyUrl: string }
  | { kind: "passwordReset"; fanName: string; resetUrl: string }
  | {
      kind: "paymentReceipt";
      fanName: string;
      amountLabel: string;
      currency: string;
      level: string;
      celebrityName: string;
      cardNumber: string;
      cardUrl: string;
      reference: string;
      paidAtLabel: string;
    }
  | { kind: "cardActivated"; fanName: string; celebrityName: string; membershipName: string; cardNumber: string; cardUrl: string }
  | { kind: "newCelebrity"; fanName: string; celebrityName: string; category: string; profileUrl: string }
  | { kind: "update"; fanName: string; message: string; linkUrl?: string; linkLabel?: string }
  | { kind: "promotion"; fanName: string; message: string; linkUrl?: string; linkLabel?: string; unsubscribeUrl: string };

export function renderEmailTemplate(input: EmailTemplate): { subject: string; html: string } {
  switch (input.kind) {
    case "welcome": {
      const html = brandLayout({
        title: "Welcome to CelebrityPass 🎉",
        body:
          para(`Hi ${input.fanName},`) +
          para(`Your CelebrityPass account has been successfully created. Your account email is registered, and you're ready to join celebrity communities, collect fan cards, and unlock member-only access.`),
        cta: { label: "Go to your dashboard", url: input.loginUrl },
        footer: transactionFooter(),
      });
      return { subject: "Welcome to CelebrityPass", html };
    }
    case "emailVerification": {
      const html = brandLayout({
        title: "Confirm your email",
        body:
          para(`Hi ${input.fanName},`) +
          para(`Please confirm your email address so we know this inbox belongs to you. This also enables urgent account &amp; security notifications. The link expires in 24 hours.`),
        cta: { label: "Verify email address", url: input.verifyUrl },
        footer: transactionFooter(),
      });
      return { subject: "Confirm your CelebrityPass email", html };
    }
    case "passwordReset": {
      const html = brandLayout({
        title: "Reset your password",
        body:
          para(`Hi ${input.fanName},`) +
          para(`We received a request to reset your CelebrityPass password. Use the button below to choose a new one. This link is valid for 1 hour.`),
        cta: { label: "Reset your password", url: input.resetUrl },
        footer: transactionFooter(),
      });
      return { subject: "Reset your CelebrityPass password", html };
    }
    case "paymentReceipt": {
      const body =
        para(`Hi ${input.fanName}, your payment has been verified and confirmed. Thank you for your support.`) +
        infoCard([
          ["Membership", `${input.celebrityName} · ${input.level}`],
          ["Amount paid", `${input.amountLabel} ${input.currency}`],
          ["Fan card", input.cardNumber],
          ["Reference", input.reference],
          ["Date", input.paidAtLabel],
        ]) +
        `<p style="margin:0 0 2px;font-size:13px;color:#a1a1aa;">Your fan-card access link:</p>`;
      const html = brandLayout({
        title: `Payment confirmed — ${input.level}`,
        body,
        cta: { label: "View your fan card", url: input.cardUrl },
        footer: transactionFooter(),
      });
      return { subject: `Payment confirmed — your ${input.level} fan card`, html };
    }
    case "cardActivated": {
      const body =
        para(`Hi ${input.fanName}, your ${input.celebrityName} fan card is now active.`) +
        infoCard([
          ["Fan card", input.cardNumber],
          ["Community", input.celebrityName],
          ...(input.membershipName ? ([["Membership", input.membershipName]] as Array<[string, string]>) : []),
        ]);
      const html = brandLayout({
        title: "Your fan card is activated",
        body,
        cta: { label: "View your fan card", url: input.cardUrl },
        footer: transactionFooter(),
      });
      return { subject: `Your ${input.celebrityName} fan card is ready`, html };
    }
    case "newCelebrity": {
      const body =
        para(`Hi ${input.fanName},`) +
        heroCard(input.celebrityName) +
        para(`${input.celebrityName} (${input.category}) is now available on CelebrityPass. Be the first to join their community and get your fan card.`);
      const html = brandLayout({
        title: "New celebrity added to CelebrityPass",
        body,
        cta: { label: "View Celebrity", url: input.profileUrl },
        footer: transactionFooter(),
      });
      return { subject: `${input.celebrityName} is now on CelebrityPass`, html };
    }
    case "update": {
      const body = para(`Hi ${input.fanName},`) + para(input.message);
      const html = brandLayout({
        title: "CelebrityPass update",
        body,
        cta: input.linkUrl && input.linkLabel ? { label: input.linkLabel, url: input.linkUrl } : undefined,
        footer: transactionFooter(),
      });
      return { subject: "Important CelebrityPass update", html };
    }
    case "promotion": {
      const body = para(`Hi ${input.fanName},`) + para(input.message);
      const html = brandLayout({
        title: "From CelebrityPass",
        body,
        cta: input.linkUrl && input.linkLabel ? { label: input.linkLabel, url: input.linkUrl } : undefined,
        unsubscribeUrl: input.unsubscribeUrl,
        footer: promoFooter(input.unsubscribeUrl),
      });
      return { subject: "From CelebrityPass", html };
    }
  }
}