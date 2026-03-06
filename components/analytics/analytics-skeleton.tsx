export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 p-4" aria-busy="true" aria-label="Loading analytics">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      {/* Another chart */}
      <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      {/* Heatmap */}
      <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  )
}
