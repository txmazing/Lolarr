import type { MediaRequest } from '@lolarr/domain'
import type { ActionComponent } from './types'
import { RequestStatusBadge } from './RequestStatusBadge'

type RequestListProps = {
  requests: MediaRequest[]
  Action: ActionComponent
  limit?: number
  onViewAll?: () => void
  onCancel?: (request: MediaRequest) => void
  cancelingId?: string
  cancelError?: { id: string; message: string }
}

export function RequestList({
  requests,
  Action,
  limit,
  onViewAll,
  onCancel,
  cancelingId,
  cancelError,
}: RequestListProps) {
  const visible = limit !== undefined ? requests.slice(0, limit) : requests

  return (
    <section className="mt-8 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">Recent requests</h2>
        {onViewAll ? (
          <Action variant="ghost" onPress={onViewAll} focusKey="requests-view-all">
            View all
          </Action>
        ) : (
          <span className="text-sm text-muted-foreground">{requests.length} tracked</span>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="flex min-h-[52px] items-center justify-between gap-3.5 rounded-md bg-surface px-3.5 py-3 text-muted-foreground">No requests yet.</p>
      ) : (
        <ul className="grid list-none gap-2.5 p-0">
          {visible.map((request) => (
            <li
              key={request.id}
              className="flex min-h-[52px] items-center justify-between gap-3.5 rounded-md bg-surface px-3.5 py-3"
            >
              <span className="font-medium">{requestTitle(request)}</span>
              <span className="flex items-center gap-2.5">
                <RequestStatusBadge status={request.status} />
                {request.seasons?.length ? <small>Seasons {request.seasons.join(', ')}</small> : null}
                {request.createdAt ? <small>{request.createdAt.slice(0, 10)}</small> : null}
              </span>
              {onCancel && request.canCancel ? (
                <Action
                  variant="ghost"
                  onPress={() => onCancel(request)}
                  focusKey={`request-cancel-${request.id}`}
                  disabled={cancelingId === request.id}
                >
                  {cancelingId === request.id ? 'Canceling...' : 'Cancel'}
                </Action>
              ) : null}
              {cancelError?.id === request.id ? (
                <small className="text-sm text-danger">{cancelError.message}</small>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function requestTitle(request: MediaRequest) {
  return request.title ?? `${request.mediaType === 'movie' ? 'Movie' : 'Series'} · TMDB ${request.tmdbId}`
}
