import Image from "next/image";

export function VaultDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Image
                src="/images/elitra-logo.png"
                alt="Elitra"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="bg-primary text-primary-foreground border-0 px-6 py-2 text-sm font-semibold rounded-full">
                TVL: Loading...
              </div>
            </div>
            <div className="h-8 w-24 bg-muted rounded"></div>
          </div>
        </div>
      </nav>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-8">
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/4"></div>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-48 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
