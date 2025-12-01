import App from "./app"
import AuthService from "./service/auth"
import Theme from "./ui/theme"

import "./index.css"

export async function startOldVersion() {
    Theme.apply(Theme.defaultDarkTheme)
    // Authentication disabled - pass empty string as token
    const token = await getAuthenticationToken() ?? ""

    if (await App.start(token)) removeSplash()
}

const SPLASH_SCREEN_VANISHING_TIME_MS = 600

function removeSplash() {
    const splash = document.getElementById("splash-screen")
    if (splash) {
        splash.classList.add("vanish")
        window.setTimeout(
            () => document.body.removeChild(splash),
            SPLASH_SCREEN_VANISHING_TIME_MS
        )
    }
}

/**
 * The token can be passed as an URL params: "token=".
 * If not, Keycloak will redirect the user to the login
 * page or take the last still valid one.
 */
async function getAuthenticationToken(): Promise<string | null> {
    return AuthService.authorize()
}
