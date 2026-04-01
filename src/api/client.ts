export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Impossible de joindre l'application locale. Verifiez que le client Vite (:8080) et l'API (:3001) sont demarres.");
    }

    throw error;
  }

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorPayload?.error ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
