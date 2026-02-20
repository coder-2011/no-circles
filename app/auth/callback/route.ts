import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase auth environment variables.");
  }

  return { supabaseUrl, supabaseAnonKey };
}

function resolvePublicOrigin(request: Request): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl && /^https?:\/\//.test(configuredSiteUrl)) {
    return configuredSiteUrl.replace(/\/+$/, "");
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const publicOrigin = resolvePublicOrigin(request);
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
