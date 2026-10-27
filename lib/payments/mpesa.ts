/**
 * ============================================================================
 * M-Pesa (Daraja API — Safaricom)
 * ============================================================================
 *
 * Server-only. Holds the OAuth access token in memory for ~55 minutes
 * (Daraja tokens expire after 1 hour) and initiates STK Push requests.
 *
 * Never log phone numbers or the passkey in full. Redact in logs.
 */

import "server-only";

/* Base URLs for sandbox vs production. */
const BASE_URL: Record<string, string> = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

type MpesaEnv = "sandbox" | "production";

function mpesaEnv(): MpesaEnv {
  return process.env.MPESA_ENV === "production" ? "production" : "sandbox";
}

function baseUrl(): string {
  return BASE_URL[mpesaEnv()];
}

/**
 * Daraja expects `YYYYMMDDHHmmss` in East Africa Time (UTC+3), regardless of
 * where the server runs. Vercel executes in UTC, so deriving the timestamp from
 * local getters would build a password that Daraja rejects.
 */
function darajaTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}${value("month")}${value("day")}${value("hour")}${value("minute")}${value("second")}`;
}

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

/**
 * OAuth access token from Daraja. Cached in memory for ~55 minutes.
 * Safaricom issues tokens valid for 1 hour; we refresh at 55 to stay safe.
 */
export async function getMpesaToken(): Promise<string> {
  const now = Date.now();

  if (tokenCache && now < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  const env = mpesaEnv();

  if (!consumerKey || !consumerSecret) {
    throw new Error(
      "MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET must be set in .env.local.",
    );
  }

  const credential = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
    "base64",
  );

  const response = await fetch(
    `${BASE_URL[env]}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credential}`,
      },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    if (response.status === 400) {
      throw new Error(
        "Safaricom rejected the M-Pesa credentials (HTTP 400). Check MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET and that they belong to a sandbox app.",
      );
    }

    if (response.status === 403) {
      throw new Error(
        "Safaricom blocked this server (HTTP 403). This is usually a network/WAF restriction; retry from the deployed Vercel domain.",
      );
    }

    throw new Error(
      `Daraja OAuth failed (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: string };

  if (!data.access_token) {
    throw new Error("Daraja OAuth response did not include an access token.");
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (Number(data.expires_in ?? 3600) - 300) * 1000, /* 5 min buffer */
  };

  return data.access_token;
}

/**
 * Normalise a Kenyan phone to 2547XXXXXXXX form (no leading +, no spaces).
 *
 * Accepts the same shapes the rest of the app does: +254..., 254..., 07...,
 * 01..., or a bare nine-digit local number.
 */
export function normalizeMpesaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return digits;
}

function redactPhone(value: string): string {
  return value.replace(/(?:\+?254|0)[17]\d{8}/g, "[redacted]");
}

function placeholderHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.includes("your-vercel-domain") ||
    host.includes("your-domain")
  );
}

/**
 * Initiate an STK Push. Returns the CheckoutRequestID from Daraja.
 *
 * `amount` is in KES (whole shillings). `accountReference` is shown on the
 * customer's phone and must stay within Daraja's 12-character limit.
 */
export async function initiateStkPush({
  phone,
  amount,
  accountReference,
  description,
}: {
  phone: string;
  amount: number;
  accountReference: string;
  description: string;
}): Promise<{ ok: true; checkoutRequestId: string } | { ok: false; error: string }> {
  try {
    if (!Number.isFinite(amount) || amount < 1) {
      return { ok: false, error: "The order total must be at least KES 1." };
    }

    const token = await getMpesaToken();
    const shortcode = process.env.MPESA_SHORTCODE?.trim();
    const passkey = process.env.MPESA_PASSKEY?.trim();
    const callbackUrl = process.env.MPESA_CALLBACK_URL?.trim();

    if (!shortcode || !passkey || !callbackUrl) {
      return {
        ok: false,
        error: "MPESA_SHORTCODE, MPESA_PASSKEY and MPESA_CALLBACK_URL must be set.",
      };
    }

    /* Daraja cannot call localhost. Catching this here produces a useful error
       instead of a generic STK rejection from Safaricom. */
    let callback: URL;
    try {
      callback = new URL(callbackUrl);
    } catch {
      return { ok: false, error: "MPESA_CALLBACK_URL is not a valid URL." };
    }
    if (callback.protocol !== "https:" || placeholderHost(callback.hostname)) {
      return {
        ok: false,
        error:
          "Set MPESA_CALLBACK_URL to your deployed Vercel domain (public HTTPS) before taking payments.",
      };
    }

    const partyA = normalizeMpesaPhone(phone);
    if (!/^254[17]\d{8}$/.test(partyA)) {
      return { ok: false, error: "Enter a valid Kenyan M-Pesa phone number." };
    }

    const timestamp = darajaTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    /* Daraja limits AccountReference to 12 characters and TransactionDesc to
       13. Truncating here keeps a long order id from turning into an opaque
       "Bad Request" from Safaricom. */
    const reference = (accountReference || "Pedigree").slice(0, 12);
    const transactionDesc = (description || "Pedigree order").slice(0, 13);

    const response = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(amount),
        PartyA: partyA,
        PartyB: shortcode,
        PhoneNumber: partyA,
        CallBackURL: callbackUrl,
        AccountReference: reference,
        TransactionDesc: transactionDesc,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        error: redactPhone(
          `STK push failed (${response.status}): ${body.slice(0, 300)}`,
        ),
      };
    }

    const data = (await response.json()) as {
      CheckoutRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      CustomerMessage?: string;
    };

    if (data.ResponseCode && data.ResponseCode !== "0") {
      return {
        ok: false,
        error:
          data.CustomerMessage ||
          data.ResponseDescription ||
          `STK push rejected (${data.ResponseCode}).`,
      };
    }

    if (!data.CheckoutRequestID) {
      return {
        ok: false,
        error: data.ResponseDescription || "STK push returned no checkout request ID.",
      };
    }

    return { ok: true, checkoutRequestId: data.CheckoutRequestID };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: redactPhone(message) };
  }
}
