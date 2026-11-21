export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function rethrowNavigation(error: unknown): void {
  if (typeof error === 'object' && error && 'digest' in error) {
    const digest = String((error as { digest?: unknown }).digest);
    if (digest.startsWith('NEXT_')) throw error;
  }
}

export function DatabaseSetup({ message }: { message: string }) {
  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="bg-white shadow rounded-lg p-4">
        <h1 className="text-xl font-semibold mb-2">Itineraries need Postgres</h1>
        <p className="text-sm text-gray-700 mb-3">
          Crop plans, tasks, routines, the daily log, and clone batches are stored in Postgres.
          Sensor series stay in InfluxDB. Photos go through the object-storage interface
          (<code>PHOTO_STORAGE=local</code> on this machine, or <code>s3</code>).
        </p>
        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto whitespace-pre-wrap">{message}</pre>
        <p className="text-sm text-gray-600 mt-3">Setup steps are in docs/itineraries.md.</p>
      </div>
    </div>
  );
}
