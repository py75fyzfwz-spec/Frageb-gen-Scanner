import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, sessionToken } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  if (!password) {
    // Ohne Passwort nur lokal erlaubt, nie öffentlich.
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse(
      "APP_PASSWORD ist nicht gesetzt. Bitte in Vercel unter Settings > Environment Variables eintragen.",
      { status: 500 },
    );
  }
  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie && cookie === (await sessionToken(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
