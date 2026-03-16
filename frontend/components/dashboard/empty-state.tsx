import { Button } from "@/components/ui/button"
import { Plus, BookOpen } from "lucide-react"
import Link from "next/link"

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <BookOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">Belum ada situs Moodle</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Mulai dengan membuat situs Moodle pertama Anda. Proses pembuatan hanya membutuhkan beberapa menit.
      </p>
      <Link href="/buat-situs" className="mt-6">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Buat Situs Pertama
        </Button>
      </Link>
    </div>
  )
}
