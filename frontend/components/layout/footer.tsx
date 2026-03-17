import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground">
              <span className="text-xs font-bold text-background">M</span>
            </div>
            <span className="text-sm text-muted-foreground">
              Moodlepilot Indonesia
            </span>
          </div>
          
          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              Tentang
            </Link>
            <Link href="/" className="transition-colors hover:text-foreground">
              Dokumentasi
            </Link>
            <Link href="/" className="transition-colors hover:text-foreground">
              Dukungan
            </Link>
            <Link href="/" className="transition-colors hover:text-foreground">
              Kebijakan Privasi
            </Link>
          </nav>
          
          <p className="text-sm text-muted-foreground">
            &copy; 2026 Moodlepilot ID
          </p>
        </div>
      </div>
    </footer>
  )
}
