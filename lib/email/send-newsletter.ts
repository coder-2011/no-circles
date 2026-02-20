import { Resend } from "resend";

type SendNewsletterArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type SendNewsletterResult = {
  ok: boolean;
  providerMessageId: string | null;
  attempts: number;
  error: string | null;
};

const MAX_SEND_ATTEMPTS = 2;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MISSING_RESEND_API_KEY");
  }
  return new Resend(apiKey);
}

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || "No Circles <newsletter@updates.nocircles.com>";
}

function getReplyToAddress(): string | undefined {
  const value = process.env.RESEND_REPLY_TO_EMAIL?.trim();
  return value && value.length > 0 ? value : undefined;
}

export async function sendNewsletter(args: SendNewsletterArgs): Promise<SendNewsletterResult> {
  const resend = getResendClient();

  let lastError = "UNKNOWN_SEND_ERROR";
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    try {
      const response = await resend.emails.send({
        from: getFromAddress(),
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
        replyTo: getReplyToAddress(),
        headers: {
          "x-newsletter-idempotency-key": args.idempotencyKey
        }
      });

      if (response.error) {
        lastError = response.error.message || "RESEND_ERROR";
      } else {
        return {
          ok: true,
          providerMessageId: response.data?.id ?? null,
          attempts: attempt,
          error: null
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "RESEND_EXCEPTION";
    }
  }

  return {
    ok: false,
    providerMessageId: null,
    attempts: MAX_SEND_ATTEMPTS,
    error: lastError
  };
}
