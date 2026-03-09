import { getSecurityId } from './config';
import { ApiError } from './errors';

/**
 * Try to extract a human-readable error message from a JSON response body.
 * Falls back to the HTTP status text if the body cannot be parsed.
 */
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      if (typeof record.message === 'string' && record.message !== '') {
        return record.message;
      }
      if (typeof record.errorMessage === 'string' && record.errorMessage !== '') {
        return record.errorMessage;
      }
    }
  } catch {
    // Response has no JSON body — fall back to statusText
  }
  return response.statusText;
}

/**
 * Perform a GET request to a CMS API endpoint.
 *
 * @throws ApiError on non-OK HTTP status
 */
export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

/**
 * Shared mutation request logic: sends a JSON body with CSRF header.
 *
 * @throws ApiError on non-OK HTTP status
 */
async function apiMutate(
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body: object,
): Promise<void> {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-SecurityID': getSecurityId(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new ApiError(response.status, message);
  }
}

/**
 * Perform a POST request to a CMS API endpoint with JSON body.
 *
 * @throws ApiError on non-OK HTTP status
 */
export async function apiPost(url: string, body: object): Promise<void> {
  return apiMutate('POST', url, body);
}

/**
 * Perform a PATCH request to a CMS API endpoint with JSON body.
 *
 * @throws ApiError on non-OK HTTP status
 */
export async function apiPatch(url: string, body: object): Promise<void> {
  return apiMutate('PATCH', url, body);
}

/**
 * Perform a DELETE request to a CMS API endpoint with JSON body.
 *
 * @throws ApiError on non-OK HTTP status
 */
export async function apiDelete(url: string, body: object): Promise<void> {
  return apiMutate('DELETE', url, body);
}
