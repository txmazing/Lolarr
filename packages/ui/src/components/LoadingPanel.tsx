import { Skeleton } from '@ui/components/ui/shadcn/skeleton'

export function LoadingPanel() {
  return (
    <section aria-label="Loading" className="flex flex-col gap-6 p-10">
      <Skeleton className="h-[40vh] w-full rounded-lg" />
      <div className="flex gap-4">
        <Skeleton className="h-56 w-40 rounded-md" />
        <Skeleton className="h-56 w-40 rounded-md" />
        <Skeleton className="h-56 w-40 rounded-md" />
        <Skeleton className="h-56 w-40 rounded-md" />
      </div>
      <p className="text-muted-foreground text-sm">Loading Lolarr</p>
    </section>
  )
}
