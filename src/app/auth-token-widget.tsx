import React from "react"
import { State } from "@/state"
import { ViewInputText, ViewPanel, ViewButton } from "@tolokoban/ui"

interface AuthTokenWidgetProps {
    className?: string
}

export function AuthTokenWidget({ className }: AuthTokenWidgetProps) {
    const [token, setToken] = State.beta.authToken.useState()
    const [isExpanded, setIsExpanded] = React.useState(false)
    const [localToken, setLocalToken] = React.useState(token ?? "")

    React.useEffect(() => {
        setLocalToken(token ?? "")
    }, [token])

    const handleSave = () => {
        State.beta.authToken.value = localToken.trim() || null
        setIsExpanded(false)
    }

    const handleClear = () => {
        setLocalToken("")
        State.beta.authToken.value = null
        setIsExpanded(false)
    }

    const hasToken = token && token.trim().length > 0

    return (
        <ViewPanel className={className} padding="S">
            {!isExpanded ? (
                <ViewPanel
                    display="flex"
                    flexDirection="row"
                    alignItems="center"
                    gap="S"
                >
                    <ViewButton
                        onClick={() => setIsExpanded(true)}
                        variant={hasToken ? "filled" : "outlined"}
                        color={hasToken ? "primary-5" : "neutral-5"}
                    >
                        {hasToken ? "🔐 Token Set" : "🔓 Set Auth Token"}
                    </ViewButton>
                    {hasToken && (
                        <ViewButton
                            onClick={handleClear}
                            variant="outlined"
                            color="error"
                        >
                            Clear
                        </ViewButton>
                    )}
                </ViewPanel>
            ) : (
                <ViewPanel
                    display="flex"
                    flexDirection="column"
                    gap="S"
                    padding="S"
                    color="neutral-2"
                >
                    <ViewInputText
                        value={localToken}
                        onChange={setLocalToken}
                        label="Authentication Token:"
                        type="password"
                        placeholder="Enter token for external resources"
                    />
                    <ViewPanel display="flex" flexDirection="row" gap="S">
                        <ViewButton
                            onClick={handleSave}
                            variant="filled"
                            color="primary-5"
                        >
                            Save
                        </ViewButton>
                        <ViewButton
                            onClick={() => {
                                setIsExpanded(false)
                                setLocalToken(token ?? "")
                            }}
                            variant="text"
                        >
                            Cancel
                        </ViewButton>
                        {hasToken && (
                            <ViewButton
                                onClick={handleClear}
                                variant="outlined"
                                color="error"
                            >
                                Clear
                            </ViewButton>
                        )}
                    </ViewPanel>
                </ViewPanel>
            )}
        </ViewPanel>
    )
}


