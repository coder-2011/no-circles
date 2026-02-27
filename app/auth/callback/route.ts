import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeEnvString } from "@/lib/utils";

function getSupabaseEnv() {
  const supabaseUrl = normalizeEnvString(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = normalizeEnvString(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase auth environment variables.");
  }

  return { supabaseUrl, supabaseAnonKey };
}

function resolvePublicOrigin(request: Request): string {
  const requestOrigin = new URL(request.url).origin;
  const requestHost = new URL(request.url).hostname.toLowerCase();
  if (requestHost === "localhost" || requestHost === "127.0.0.1" || requestHost === "::1") {
    return requestOrigin;
  }

  if (process.env.NODE_ENV !== "production") {
    return requestOrigin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    const forwardedOrigin = `${forwardedProto}://${forwardedHost}`;
    return forwardedOrigin;
  }

  return requestOrigin;
}

function resolveLocalCallbackOriginOverride(requestUrl: URL): string | null {
  const callbackOrigin = requestUrl.searchParams.get("callback_origin");
  if (!callbackOrigin) {
    return null;
  }

  try {
    const parsedOrigin = new URL(callbackOrigin).origin;
    const callbackHost = new URL(parsedOrigin).hostname.toLowerCase();
    if (callbackHost === "localhost" || callbackHost === "127.0.0.1" || callbackHost === "::1") {
      return parsedOrigin;
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const callbackOriginOverride = resolveLocalCallbackOriginOverride(requestUrl);
  const publicOrigin = callbackOriginOverride ?? resolvePublicOrigin(request);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next") ?? "/onboarding";
  const redirectTo = nextParam.startsWith("/") ? nextParam : "/onboarding";
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });

  async function redirectBasedOnSessionOnError() {
    const userLookup = await supabase.auth.getUser();
    if (userLookup.data.user?.email) {
      return NextResponse.redirect(new URL(redirectTo, publicOrigin));
    }

    return NextResponse.redirect(new URL("/?auth=oauth_error", publicOrigin));
  }

  const providerError = requestUrl.searchParams.get("error");
  if (providerError) {
    return redirectBasedOnSessionOnError();
  }

  if (!code) {
    const userLookup = await supabase.auth.getUser();
    if (userLookup.data.user?.email) {
      return NextResponse.redirect(new URL(redirectTo, publicOrigin));
    }

    return NextResponse.redirect(new URL("/?auth=oauth_code_missing", publicOrigin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectBasedOnSessionOnError();
  }

  return NextResponse.redirect(new URL(redirectTo, publicOrigin));
}
