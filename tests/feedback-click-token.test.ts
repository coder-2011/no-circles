import { describe, expect, it } from "vitest";
import {
  buildFeedbackClickUrl,
  createFeedbackClickToken,
  verifyFeedbackClickToken
} from "@/lib/feedback/click-token";

describe("feedback click token", () => {
  const secret = "test_feedback_secret";

  it("round-trips valid tokens", () => {
    const token = createFeedbackClickToken({
      userId: "user-1",
      url: "https://example.com/article",
      title: "Article A",
      feedbackType: "more_like_this",
      secret,
      expiresAtUnixSeconds: 2000
    });

    const verified = verifyFeedbackClickToken({
      token,
      secret,
      nowUnixSeconds: 1000
    });

    expect(verified.ok).toBe(true);
    if (!verified.ok) {
      return;
    }

    expect(verified.payload.uid).toBe("user-1");
    expect(verified.payload.url).toBe("https://example.com/article");
    expect(verified.payload.title).toBe("Article A");
    expect(verified.payload.ft).toBe("more_like_this");
  });

  it("rejects tampered tokens", () => {
    const token = createFeedbackClickToken({
      userId: "user-1",
      url: "https://example.com/article",
      title: "Article B",
      feedbackType: "less_like_this",
      secret,
      expiresAtUnixSeconds: 2000
    });

    const [payloadPart, signaturePart] = token.split(".");
    const tamperedSignature = `${signaturePart?.slice(0, -1) ?? ""}x`;
    const tampered = `${payloadPart}.${tamperedSignature}`;
    const verified = verifyFeedbackClickToken({ token: tampered, secret, nowUnixSeconds: 1000 });

    expect(verified.ok).toBe(false);
    if (verified.ok) {
      return;
    }

    expect(verified.reason).toBe("INVALID_TOKEN_SIGNATURE");
  });

  it("rejects expired tokens", () => {
    const token = createFeedbackClickToken({
      userId: "user-1",
      url: "https://example.com/article",
      title: "Article C",
      feedbackType: "less_like_this",
      secret,
      expiresAtUnixSeconds: 1000
    });

    const verified = verifyFeedbackClickToken({ token, secret, nowUnixSeconds: 1001 });

    expect(verified.ok).toBe(false);
    if (verified.ok) {
      return;
    }

    expect(verified.reason).toBe("TOKEN_EXPIRED");
  });

  it("builds feedback click URL", () => {
    const url = buildFeedbackClickUrl({
      baseUrl: "https://nocircles.app",
      token: "abc"
    });

    expect(url).toBe("https://nocircles.app/api/feedback/click?token=abc");
  });
});
