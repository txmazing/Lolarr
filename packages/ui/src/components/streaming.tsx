import type { ComponentType, ReactNode } from 'react'
import type { Availability, MediaItem, MediaRequest } from '@lolarr/domain'

export type ActionProps = {
  ariaLabel?: string
  children: ReactNode
  className?: string
  disabled?: boolean
  focusKey?: string
  onPress?: () => void
  type?: 'button' | 'submit'
}

export type ActionComponent = ComponentType<ActionProps>

export type TextInputProps = {
  ariaLabel?: string
  autoComplete?: string
  className?: string
  defaultValue?: string
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
  focusKey?: string
  name?: string
  nextFocusKey?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  required?: boolean
  submitOnEnter?: boolean
  type?: 'text' | 'password'
  value?: string
}

export type TextInputComponent = ComponentType<TextInputProps>

export type ShellProps = {
  children: ReactNode
}

type AppFrameProps = {
  children: ReactNode
  onConfigureGateway?: () => void
  userName?: string
  onSignOut?: () => void
  Action: ActionComponent
}

type HeroProps = {
  item?: MediaItem
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
}

type MediaRailProps = {
  id: string
  title: string
  items: MediaItem[]
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
}

type DetailPanelProps = {
  item: MediaItem
  isRequesting?: boolean
  onBack: () => void
  onRequest: (item: MediaItem) => void
  Action: ActionComponent
}

type RequestListProps = {
  requests: MediaRequest[]
}

type LoginPanelProps = {
  Action: ActionComponent
  error?: string
  TextInput: TextInputComponent
  isLoading?: boolean
}

type GatewayPanelProps = {
  Action: ActionComponent
  defaultUrl?: string
  error?: string
  TextInput: TextInputComponent
}

export function DefaultAction({
  children,
  className,
  disabled,
  onPress,
  type = 'button',
}: ActionProps) {
  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  )
}

export function DefaultTextInput({
  ariaLabel,
  autoComplete,
  className,
  defaultValue,
  enterKeyHint,
  name,
  onValueChange,
  placeholder,
  required,
  type = 'text',
  value,
}: TextInputProps) {
  return (
    <input
      aria-label={ariaLabel}
      autoComplete={autoComplete}
      className={className}
      defaultValue={defaultValue}
      enterKeyHint={enterKeyHint}
      name={name}
      onChange={(event) => onValueChange?.(event.currentTarget.value)}
      placeholder={placeholder}
      required={required}
      type={type}
      value={value}
    />
  )
}

export function AppFrame({
  children,
  onConfigureGateway,
  userName,
  onSignOut,
  Action,
}: AppFrameProps) {
  return (
    <main className="lolarr-app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lolarr</p>
          <h1>Watch what you have. Request what you want.</h1>
        </div>
        <nav className="topbar-actions" aria-label="Primary">
          {onConfigureGateway ? (
            <Action
              className="ghost-action"
              onPress={onConfigureGateway}
              focusKey="configure-gateway"
            >
              Gateway
            </Action>
          ) : null}
          {userName ? (
            <>
              <span className="user-chip">{userName}</span>
              <Action className="ghost-action" onPress={onSignOut} focusKey="sign-out">
                Sign out
              </Action>
            </>
          ) : null}
        </nav>
      </header>
      {children}
    </main>
  )
}

export function GatewayPanel({
  Action,
  defaultUrl,
  error,
  TextInput,
}: GatewayPanelProps) {
  return (
    <section className="gateway-panel">
      <div>
        <p className="eyebrow">Gateway setup</p>
        <h2>Connect this TV to Lolarr.</h2>
        <p>
          Enter the API URL from the machine running the gateway. On Tizen this
          must be an absolute network URL, for example http://192.168.1.50:4000.
        </p>
      </div>
      <div className="login-fields">
        <label>
          Gateway URL
          <TextInput
            autoComplete="off"
            defaultValue={defaultUrl}
            enterKeyHint="done"
            focusKey="gateway-api-url"
            name="apiUrl"
            placeholder="http://192.168.1.50:4000"
            required
            submitOnEnter
          />
        </label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <Action className="primary-action" focusKey="gateway-submit" type="submit">
        Save gateway
      </Action>
    </section>
  )
}

export function LoginPanel({
  Action,
  error,
  isLoading,
  TextInput,
}: LoginPanelProps) {
  return (
    <section className="login-panel">
      <div>
        <p className="eyebrow">Jellyfin login</p>
        <h2>One account for your library and requests.</h2>
        <p>
          Use your Jellyfin credentials. Lolarr keeps the session in its gateway
          and uses Seerr server-side for discovery and requests.
        </p>
      </div>
      <div className="login-fields">
        <label>
          Server user
          <TextInput
            autoComplete="username"
            enterKeyHint="next"
            focusKey="login-username"
            name="username"
            nextFocusKey="login-password"
            required
          />
        </label>
        <label>
          Password
          <TextInput
            autoComplete="current-password"
            enterKeyHint="done"
            focusKey="login-password"
            name="password"
            required
            submitOnEnter
            type="password"
          />
        </label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <Action
        className="primary-action"
        disabled={isLoading}
        focusKey="login-submit"
        type="submit"
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Action>
    </section>
  )
}

export function SearchBar({
  TextInput,
  query,
  onQueryChange,
}: {
  TextInput: TextInputComponent
  query: string
  onQueryChange: (query: string) => void
}) {
  return (
    <label className="search-bar">
      <span>Search</span>
      <TextInput
        autoComplete="off"
        enterKeyHint="search"
        focusKey="search-input"
        onValueChange={onQueryChange}
        placeholder="Movies, series, requests"
        value={query}
      />
    </label>
  )
}

export function HeroPanel({ item, onOpen, Action }: HeroProps) {
  if (!item) {
    return (
      <section className="hero-panel skeleton-panel">
        <p className="eyebrow">Discover</p>
        <h2>Loading your next title...</h2>
      </section>
    )
  }

  return (
    <section
      className="hero-panel"
      style={{
        backgroundImage: item.backdropUrl
          ? `linear-gradient(90deg, rgba(8, 10, 14, 0.96), rgba(8, 10, 14, 0.66), rgba(8, 10, 14, 0.16)), url(${item.backdropUrl})`
          : undefined,
      }}
    >
      <div className="hero-copy">
        <StatusBadge availability={item.availability} />
        <h2>{item.title}</h2>
        <p>{item.overview}</p>
        <div className="hero-meta">
          {item.year ? <span>{item.year}</span> : null}
          <span>{item.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
        </div>
        <Action
          className="primary-action"
          onPress={() => onOpen(item)}
          focusKey={`hero-${item.mediaType}-${item.tmdbId}`}
        >
          Open details
        </Action>
      </div>
    </section>
  )
}

export function MediaRail({ id, title, items, onOpen, Action }: MediaRailProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="media-rail" aria-labelledby={`${id}-title`}>
      <div className="rail-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        <span>{items.length} titles</span>
      </div>
      <div className="rail-scroll">
        {items.map((item) => (
          <MediaPosterButton
            key={`${item.mediaType}-${item.tmdbId}`}
            item={item}
            onOpen={onOpen}
            Action={Action}
          />
        ))}
      </div>
    </section>
  )
}

export function MediaPosterButton({
  item,
  onOpen,
  Action,
}: {
  item: MediaItem
  onOpen: (item: MediaItem) => void
  Action: ActionComponent
}) {
  return (
    <Action
      className="media-card"
      onPress={() => onOpen(item)}
      focusKey={`card-${item.mediaType}-${item.tmdbId}`}
      ariaLabel={`Open ${item.title}`}
    >
      <span className="poster-frame">
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" loading="lazy" />
        ) : (
          <span className="poster-fallback">{item.title.slice(0, 1)}</span>
        )}
      </span>
      <span className="media-card-title">{item.title}</span>
      <span className="media-card-meta">
        {item.year ? `${item.year} · ` : ''}
        {labelForAvailability(item.availability)}
      </span>
    </Action>
  )
}

export function DetailPanel({
  item,
  isRequesting,
  onBack,
  onRequest,
  Action,
}: DetailPanelProps) {
  const canRequest =
    item.availability === 'requestable' || item.availability === 'unavailable'

  return (
    <section className="detail-panel">
      <div className="detail-backdrop">
        {item.backdropUrl ? <img src={item.backdropUrl} alt="" /> : null}
      </div>
      <div className="detail-content">
        <Action className="ghost-action" onPress={onBack} focusKey="detail-back">
          Back
        </Action>
        <div className="detail-grid">
          <div className="detail-poster">
            {item.posterUrl ? <img src={item.posterUrl} alt="" /> : null}
          </div>
          <div>
            <StatusBadge availability={item.availability} />
            <h2>{item.title}</h2>
            <p>{item.overview}</p>
            <div className="hero-meta">
              {item.year ? <span>{item.year}</span> : null}
              <span>{item.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
              <span>TMDB {item.tmdbId}</span>
            </div>
            <Action
              className="primary-action"
              disabled={!canRequest || isRequesting}
              onPress={() => onRequest(item)}
              focusKey={`request-${item.mediaType}-${item.tmdbId}`}
            >
              {requestLabel(item.availability, Boolean(isRequesting))}
            </Action>
          </div>
        </div>
      </div>
    </section>
  )
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

export function StatusBadge({ availability }: { availability: Availability }) {
  return (
    <span className={`status-badge status-${availability}`}>
      {labelForAvailability(availability)}
    </span>
  )
}

export function LoadingPanel() {
  return (
    <section className="loading-panel">
      <div className="loader-line" />
      <p>Loading Lolarr</p>
    </section>
  )
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <section className="error-panel">
      <p className="eyebrow">Gateway</p>
      <h2>Something failed.</h2>
      <p>{message}</p>
    </section>
  )
}

function requestLabel(availability: Availability, isRequesting: boolean) {
  if (isRequesting) {
    return 'Requesting...'
  }

  if (availability === 'available' || availability === 'partiallyAvailable') {
    return 'Available in Jellyfin'
  }

  if (availability === 'requested') {
    return 'Already requested'
  }

  if (availability === 'processing') {
    return 'Processing'
  }

  return 'Request in Seerr'
}

function labelForAvailability(availability: Availability) {
  switch (availability) {
    case 'available':
      return 'Available'
    case 'partiallyAvailable':
      return 'Partially available'
    case 'processing':
      return 'Processing'
    case 'requested':
      return 'Requested'
    case 'requestable':
      return 'Requestable'
    case 'unavailable':
      return 'Unavailable'
  }
}
