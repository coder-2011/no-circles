import { NextResponse } from "next/server";

export async function POST() {
  // TODO: verify Resend signature, parse sender/body, and update interest_memory_text.
  return NextResponse.json({ ok: true, status: "ignored" });
}
