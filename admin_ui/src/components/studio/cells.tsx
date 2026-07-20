"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function BoolBadge({
  value,
  trueLabel = "Yes",
  falseLabel = "No",
}: {
  value: boolean
  trueLabel?: string
  falseLabel?: string
}) {
  return (
    <Badge
      variant={value ? "default" : "outline"}
      className={cn(
        "font-normal",
        value ? "bg-primary/20 text-primary hover:bg-primary/20" : ""
      )}
    >
      {value ? trueLabel : falseLabel}
    </Badge>
  )
}

export function SchemaBadge({ schema }: { schema: string }) {
  return (
    <Badge variant="secondary" className="font-mono text-[11px] font-normal">
      {schema}
    </Badge>
  )
}

export function NameCell({
  schema,
  name,
  icon,
}: {
  schema?: string
  name: string
  icon?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">{name}</p>
        {schema ? (
          <p className="truncate font-mono text-[11px] leading-tight text-muted-foreground">
            {schema}
          </p>
        ) : null}
      </div>
    </div>
  )
}
