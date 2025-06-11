"use client"


export function LayoutChat({ children }: { children: React.ReactNode }) {

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <main className="@container relative h-dvh w-0 flex-shrink flex-grow overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
