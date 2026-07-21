"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function AdminLogoutButton({
  variant = "outline",
  size = "sm",
}: {
  variant?: "outline" | "ghost"
  size?: "sm" | "default"
}) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" })
        const data = await res.json()
        setVisible(Boolean(data.enabled && data.authenticated))
      } catch {
        setVisible(false)
      }
    })()
  }, [])

  if (!visible) return null

  async function logout() {
    setLoading(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      toast.success("Signed out")
      router.replace("/login")
      router.refresh()
    } catch {
      toast.error("Sign out failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant={variant} size={size} onClick={() => void logout()} disabled={loading}>
      <LogOut className="size-3.5" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  )
}
