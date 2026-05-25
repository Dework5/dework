import { IssueCard } from './IssueCard'
import { Issue } from '@/lib/types'

interface IssuesGridProps {
  issues: Issue[]
  slug: string
}

export function IssuesGrid({ issues, slug }: IssuesGridProps) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-text-muted font-body">No hay ediciones publicadas aún.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {issues.map((issue, index) => (
        <IssueCard key={issue.id} issue={issue} slug={slug} index={index} />
      ))}
    </div>
  )
}
