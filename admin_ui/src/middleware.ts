import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  isAdminAuthEnabled,
  isAdminAuthenticated,
  isPublicAdminPath,
} from "@/lib/admin-auth"

export async function middleware(request: NextRequest) {
  if (!isAdminAuthEnabled()) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  if (isPublicAdminPath(pathname)) {
    return NextResponse.next()
  }

  if (pathname === "/login") {
    if (await isAdminAuthenticated(request)) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  if (await isAdminAuthenticated(request)) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const loginUrl = new URL("/login", request.url)
  const nextPath = `${pathname}${request.nextUrl.search}`
  if (nextPath && nextPath !== "/") {
    loginUrl.searchParams.set("next", nextPath)
  }
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
