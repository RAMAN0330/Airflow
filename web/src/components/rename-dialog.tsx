"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCatalogStore } from "@/stores/catalog-store"
import { useSessionStore } from "@/stores/session-store"

export function RenameDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so the field starts from the current name each time. */}
        {open && <RenameForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({ onDone }: { onDone: () => void }) {
  const me = useSessionStore((s) => s.me)
  const rename = useSessionStore((s) => s.rename)
  const [value, setValue] = useState(me?.display_name ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await rename(value)
      useCatalogStore.setState({ leaderboards: {} })
      toast.success("Display name updated")
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Your display name</DialogTitle>
        <DialogDescription>This is how you appear on the leaderboard.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={24}
          autoFocus
          aria-invalid={!!error}
        />
        <p className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {error ?? "2–24 characters: letters, numbers, spaces, dots, dashes or underscores."}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || value.trim().length < 2}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  )
}
