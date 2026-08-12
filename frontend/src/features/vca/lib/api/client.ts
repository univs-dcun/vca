// Shared API config. Swap the mock functions in each api/*.ts file for real
// fetch() calls against this base URL once the backend is ready.

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// Small artificial delay so loading states are actually visible during dev,
// instead of resolving instantly. Remove once real fetch() calls replace these.
export function mockDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}
