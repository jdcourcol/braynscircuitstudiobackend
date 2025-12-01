import { State } from "@/state"

/**
 * Makes an authenticated fetch request using the stored authentication token.
 * If a token is available, it will be added to the Authorization header.
 * @param url - The URL to fetch
 * @param init - Optional fetch init parameters
 * @returns A Promise that resolves to the Response
 */
export async function authenticatedFetch(
    url: string | URL,
    init?: RequestInit
): Promise<Response> {
    const token = State.beta.authToken.value
    const headers = new Headers(init?.headers)

    // Add Authorization header if token is available
    if (token && token.trim()) {
        headers.set("Authorization", `Bearer ${token}`)
    }

    // Merge with existing headers
    const fetchInit: RequestInit = {
        ...init,
        headers,
    }

    return fetch(url, fetchInit)
}


