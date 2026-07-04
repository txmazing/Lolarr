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
    <section className="request-list">
      <div className="rail-heading">
        <h2>Recent requests</h2>
        {onViewAll ? (
          <Action className="ghost-action" onPress={onViewAll} focusKey="requests-view-all">
            View all
          </Action>
        ) : (
          <span>{requests.length} tracked</span>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="empty-state">No requests yet.</p>
      ) : (
        <ul>
          {visible.map((request) => (
            <li key={request.id}>
              <span className="request-title">{requestTitle(request)}</span>
              <span className="request-meta">
                <RequestStatusBadge status={request.status} />
                {request.seasons?.length ? <small>Seasons {request.seasons.join(', ')}</small> : null}
                {request.createdAt ? <small>{request.createdAt.slice(0, 10)}</small> : null}
              </span>
              {onCancel && request.canCancel ? (
                <Action
                  className="ghost-action"
                  onPress={() => onCancel(request)}
                  focusKey={`request-cancel-${request.id}`}
                  disabled={cancelingId === request.id}
                >
                  {cancelingId === request.id ? 'Canceling...' : 'Cancel'}
                </Action>
              ) : null}
              {cancelError?.id === request.id ? (
                <small className="request-error">{cancelError.message}</small>
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
