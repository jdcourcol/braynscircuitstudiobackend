import AuthenticationServiceInterface from "@/_old_/contract/service/auth"
import AuthStorage from "./auth-storage"
import {
    generateCodeChallenge,
    generateCodeVerifier,
} from "@/_old_/tool/crypto/pkce"
import { HTTP_200_OK } from "../../http/status"
import APP_CONFIG from "../../config"
import { isString } from "../../tool/validator"
import React from "react"
/* eslint-disable camelcase */

const HOUR_TO_SECONDS = 3600

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

function seconds_to_milliseconds(seconds: number) {
    const SECOND_TO_MILLISECONDS = 1000
    return seconds * SECOND_TO_MILLISECONDS
}

class AuthService implements AuthenticationServiceInterface {
    private readonly props = {
        clientId: APP_CONFIG.authClientId,
        redirectUri: APP_CONFIG.authRedirectUri,
        ssoUrl: APP_CONFIG.authSSOUrl,
        tokenUrl: APP_CONFIG.authTokenUrl,
    }
    private codeVerifier: string | undefined = undefined
    private readonly storage = new AuthStorage()

    constructor() {
        const args = new URLSearchParams(window.location.search)
        const tokenFromParams = args.get("token")
        if (isString(tokenFromParams)) {
            console.info("A token has been provided as URL param.")
        }
    }

    useToken() {
        const [token, setToken] = React.useState<string | null>(null)
        this.authorize().then(setToken).catch(console.error)
        return token
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

    private async getAccessTokenFromStorage(): Promise<string | null> {
        const args = new URLSearchParams(window.location.search)
        const tokenParam = args.get("token")
        if (tokenParam) {
            await this.storage.save("authAccessToken", tokenParam)
            const now = Date.now()
            const expiresAt = now + seconds_to_milliseconds(3600)
            await this.storage.save("authAccessTokenExpiresAt", expiresAt)
            return tokenParam
        }

        const token = await this.storage.load("authAccessToken", null)
        const expiresAt = await this.storage.load(
            "authAccessTokenExpiresAt",
            null
        )
        const now = Date.now()
        return typeof expiresAt === "number" &&
            typeof token === "string" &&
            token &&
            expiresAt > now
            ? token
            : null
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
        for (const [key, value] of Object.entries(requestPayload)) {
            if (value) requestBody.append(key, value)
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
            await this.saveAccessToken(tokenResponse)
            window.history.pushState(
                {},
                document.title,
                window.location.pathname
            )
            return tokenResponse.access_token
        }
        return null
    }

    private async saveAccessToken(tokenResponse: KeycloakTokenResponse) {
        const now = Date.now()
        const expiresAt =
            now + seconds_to_milliseconds(tokenResponse.expires_in)
        await this.storage.save("authAccessToken", tokenResponse.access_token)
        await this.storage.save("authAccessTokenReceivedAt", now)
        await this.storage.save("authAccessTokenExpiresAt", expiresAt)
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

    private async generateCodeVerifier() {
        const now = Date.now()
        const cachedCodeVerifier = await this.storage.load(
            "authCodeVerifier",
            null
        )
        const cachedCodeVerifierExpiresAt = parseFloat(
            `${
                (await this.storage.load("authCodeVerifierExpiresAt", now)) ??
                now
            }`
        )
        if (
            typeof cachedCodeVerifier === "string" &&
            cachedCodeVerifierExpiresAt &&
            cachedCodeVerifierExpiresAt > now
        ) {
            this.codeVerifier = cachedCodeVerifier
        } else {
            this.codeVerifier = generateCodeVerifier()
            await this.storage.save("authCodeVerifier", this.codeVerifier)
            await this.storage.save(
                "authCodeVerifierExpiresAt",
                now + seconds_to_milliseconds(HOUR_TO_SECONDS)
            )
        }
    }

    private getCodeChallenge() {
        return generateCodeChallenge(this.codeVerifier ?? "")
    }
}

/** We need a singleton to keep the last still uptodate token we received. */
const singleton = new AuthService()
export default singleton
