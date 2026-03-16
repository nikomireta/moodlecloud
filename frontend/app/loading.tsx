export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        {/* Logo */}
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground">
          <span className="text-xl font-bold text-background">M</span>
        </div>
        
        {/* Loading Spinner */}
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>
        
        {/* Text */}
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </div>
    </div>
  )
}
