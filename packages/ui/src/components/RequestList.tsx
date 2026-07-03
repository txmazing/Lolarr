import type { MediaRequest } from '@lolarr/domain'

type RequestListProps = {
  requests: MediaRequest[]
}

export function RequestList({ requests }: RequestListProps) {
  return (
    <section className="request-list">
      <div className="rail-heading">
        <h2>Recent requests</h2>
        <span>{requests.length} tracked</span>
      </div>
      {requests.length === 0 ? (
        <p className="empty-state">No requests yet.</p>
      ) : (
        <ul>
          {requests.map((request) => (
            <li key={request.id}>
              <span>{request.title}</span>
              <small>
                {request.status} by {request.requestedBy.name}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
