import { SessionStorage } from "@/manager/storage"
import { isString, isType } from "@tolokoban/type-guards"
import {
    AUTH_CLIENT_ID,
    AUTH_REDIRECT_URI,
    AUTH_SSO_URL,
    AUTH_TOKEN_URL,
} from "../config"
import { ExpirableValue } from "./types"
import { generateCodeChallenge, generateCodeVerifier } from "./pkce"

const HTTP_200_OK = 200
const EXPIRATION_TIME_IN_SEC = 3600

export interface AuthServiceProps {
    clientId: string
    ssoUrl: string
    redirectUri: string
    tokenUrl: string
}

interface KeycloakTokenResponse {
    access_token: string
    expires_in: number
    refresh_expires_in: number
    refresh_token: string
    token_type: string
    id_token: string
    session_state: string
    scope: string
}

function isExpirableValue(data: unknown): data is ExpirableValue {
    return isType(data, {
        value: "string",
        expiresAt: "number",
        receivedAt: "number",
    })
}

function seconds_to_milliseconds(seconds: number) {
    const SECOND_TO_MILLISECONDS = 1000
    return seconds * SECOND_TO_MILLISECONDS
}

class AuthService {
    private readonly props = {
        clientId: AUTH_CLIENT_ID,
        redirectUri: AUTH_REDIRECT_URI,
        ssoUrl: AUTH_SSO_URL,
        tokenUrl: AUTH_TOKEN_URL,
    }
    private codeVerifier: ExpirableValue | undefined = undefined
    private readonly storage = new SessionStorage("auth", isExpirableValue)

    constructor() {
        const args = new URLSearchParams(window.location.search)
        const tokenFromParams = args.get("token")
        if (isString(tokenFromParams)) {
            console.info("A token has been provided as URL param.")
        }
    }

    public async authorize() {
        // Authentication disabled - return null without redirecting
        return null
    }

    public async getToken(): Promise<string | null> {
        // Authentication disabled - return null
        return null
    }

    private redirectToKeycloakAuthorizationPage() {
        const requestParams = {
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            code_challenge: this.getCodeChallenge(),
            response_type: "code",
            code_challenge_method: "S256",
            scope: "profile openid nexus groups",
        }
        const requestUrl = new URL(this.ssoUrl)
        for (const [key, value] of Object.entries(requestParams)) {
            requestUrl.searchParams.append(key, value)
        }
        const urlString = requestUrl.toString()
        window.location.href = urlString
    }

    private getAccessTokenFromStorage(): ExpirableValue | null {
        const args = new URLSearchParams(window.location.search)
        const tokenParam = args.get("token")
        if (tokenParam) {
            const now = Date.now()
            const expiresAt =
                now + seconds_to_milliseconds(EXPIRATION_TIME_IN_SEC)
            const token = {
                value: tokenParam,
                expiresAt,
                receivedAt: now,
            }
            this.storage.set("accessToken", token)
            return token
        }

        const token = this.storage.get("accessToken", {
            value: "",
            expiresAt: 0,
            receivedAt: 0,
        })
        const now = Date.now()
        return token.value && token.expiresAt > now ? token : null
    }

    private async getAccessTokenFromKeycloak(
        authorizationCode: string
    ): Promise<string | null> {
        const requestPayload = {
            client_id: this.clientId,
            grant_type: "authorization_code",
            redirect_uri: this.redirectUri,
            code: authorizationCode,
            code_verifier: this.codeVerifier,
            scope: "profile openid nexus groups",
        }
        const requestUrl = new URL(this.tokenUrl)
        const requestBody = new URLSearchParams()
        for (const [key, item] of Object.entries(requestPayload)) {
            if (isExpirableValue(item)) {
                requestBody.append(key, item.value)
            } else if (item) requestBody.append(key, item)
        }
        const request = new Request(requestUrl.toString(), {
            redirect: "follow",
            method: "post",
            headers: [
                ["Content-Type", "application/x-www-form-urlencoded"],
                ["Accept", "application/json"],
            ],
            body: requestBody,
        })
        const response = await fetch(request)
        if (response.status === HTTP_200_OK) {
            const tokenResponse =
                (await response.json()) as KeycloakTokenResponse
            this.saveAccessToken(tokenResponse)
            window.history.pushState(
                {},
                document.title,
                window.location.pathname
            )
            return tokenResponse.access_token
        }
        return null
    }

    private saveAccessToken(tokenResponse: KeycloakTokenResponse) {
        const value = tokenResponse.access_token
        const receivedAt = Date.now()
        const expiresAt =
            receivedAt + seconds_to_milliseconds(tokenResponse.expires_in)
        this.storage.set("accessToken", { value, expiresAt, receivedAt })
    }

    private get clientId() {
        return this.props.clientId
    }

    private get redirectUri() {
        return this.props.redirectUri
    }

    private get ssoUrl() {
        return this.props.ssoUrl
    }

    private get tokenUrl() {
        return this.props.tokenUrl
    }

    private generateCodeVerifier() {
        const now = Date.now()
        const cachedCodeVerifier = this.storage.get("verifier", {
            value: "",
            expiresAt: 0,
            receivedAt: 0,
        })
        if (cachedCodeVerifier.expiresAt > now) {
            this.codeVerifier = cachedCodeVerifier
        } else {
            this.codeVerifier = generateCodeVerifier()
            this.storage.set("verifier", this.codeVerifier)
        }
    }

    private getCodeChallenge() {
        const { codeVerifier } = this
        if (!codeVerifier) return ""

        return generateCodeChallenge(codeVerifier)
    }
}

/** We need a singleton to keep the last still uptodate token we received. */
const singleton = new AuthService()
export default singleton
