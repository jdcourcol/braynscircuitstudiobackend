export function makeWebsocketURL(hostname: string, port: number): URL {
    const host = hostname.trim()
    return new URL(`ws://${host}:${port}`)
}
