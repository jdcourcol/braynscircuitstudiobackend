import { AppConfiguration } from "./types"

// eslint-disable-next-line init-declarations
declare const ENV_VARIABLES: { [key: string]: string }
// eslint-disable-next-line no-console

const DEFAULTS: Partial<AppConfiguration> = {
    authClientId: "bbp-braynscircuitstudio",
    authSSOUrl:
        "https://bbpauth.epfl.ch/auth/realms/BBP/protocol/openid-connect/auth",
    authTokenUrl:
        "https://bbpauth.epfl.ch/auth/realms/BBP/protocol/openid-connect/token",
    unicoreUrl: "https://unicore.bbp.epfl.ch:8080/BB5-CSCS/rest/core",
    authRedirectUri: window.location.origin,
    allocationMemory: "96G",
    allocationAccount: "proj3",
    allocationPartition: "prod",
}

const APP_CONFIG: AppConfiguration = {
    ...DEFAULTS,
    authClientId: ENV_VARIABLES.BCS_AUTH_CLIENT_ID ?? DEFAULTS.authClientId,
    authRedirectUri:
        ENV_VARIABLES.BCS_AUTH_REDIRECT_URI ?? DEFAULTS.authRedirectUri,
    authSSOUrl: ENV_VARIABLES.BCS_AUTH_SSO_URL ?? DEFAULTS.authSSOUrl,
    authTokenUrl: ENV_VARIABLES.BCS_AUTH_TOKEN_URL ?? DEFAULTS.authTokenUrl,
    unicoreUrl: ENV_VARIABLES.BCS_UNICORE_URL ?? DEFAULTS.unicoreUrl,
    allocationMemory:
        ENV_VARIABLES.BCS_ALLOCATION_MEMORY ?? DEFAULTS.allocationMemory,
    allocationAccount:
        ENV_VARIABLES.BCS_ALLOCATION_ACCOUNT ?? DEFAULTS.allocationAccount,
    allocationPartition:
        ENV_VARIABLES.BCS_ALLOCATION_PARTITION ?? DEFAULTS.allocationPartition,
    braynsPort: "5000",
    braynsProtocol: "ws:",
    backendPort: "8000",
    backendProtocol: "ws:",
}

export default APP_CONFIG
