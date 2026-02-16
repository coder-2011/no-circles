import { NextResponse } from "next/server";
import { cronGenerateNextSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const json = await request.json().catch(() => ({}));
  const parsed = cronGenerateNextSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_code: "INVALID_PAYLOAD", message: "Invalid cron payload." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, status: "no_due_user" });
}
