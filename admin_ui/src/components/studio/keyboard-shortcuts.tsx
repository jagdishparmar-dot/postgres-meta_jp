"use client"

import { useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const SHORTCUTS: { group: string; items: { keys: string[]; label: string }[] }[] =
  [
    {
      group: "Navigation",
      items: [
        { keys: ["⌘", "K"], label: "Global catalog search" },
        { keys: ["?"], label: "Keyboard shortcuts" },
      ],
    },
    {
      group: "SQL Editor",
      items: [
        { keys: ["⌘", "Enter"], label: "Run query (or selection)" },
      ],
    },
    {
      group: "General",
      items: [{ keys: ["Esc"], label: "Close dialog / panel" }],
    },
  ]

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            On Windows/Linux, use Ctrl instead of ⌘.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {SHORTCUTS.map((section) => (
            <div key={section.group}>
              <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {section.group}
              </p>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function useKeyboardShortcutsHotkey(onOpen: () => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el?.closest("input, textarea, [contenteditable='true']")) return
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onOpen])
}
