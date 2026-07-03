export function ErrorPanel({ message }: { message: string }) {
  return (
    <section className="error-panel">
      <p className="eyebrow">Gateway</p>
      <h2>Something failed.</h2>
      <p>{message}</p>
    </section>
  )
}
