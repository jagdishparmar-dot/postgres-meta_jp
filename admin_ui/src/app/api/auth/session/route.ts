import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthEnabled, isAdminAuthenticated } from "@/lib/admin-auth"

export async function GET(request: NextRequest) {
  const enabled = isAdminAuthEnabled()
  return NextResponse.json({
    enabled,
    authenticated: enabled ? await isAdminAuthenticated(request) : true,
  })
}
