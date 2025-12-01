import * as React from "react"

import Dialog from "@/_old_/ui/view/dialog"
import BraynsApiServiceInterface from "@/_old_/contract/service/brayns-api/brayns-api"
import AuthService from "@/_old_/service/auth"
import BackendManagerInterface from "../../contract/manager/backend"
import { assertType } from "../../tool/validator"

import "./about-view.css"
import Button from "@/_old_/ui/view/button"
import { useModal } from "@/_old_/ui/modal"

export interface AboutViewProps {
    className?: string
    renderer: BraynsApiServiceInterface
    backend: BackendManagerInterface
    onClose(this: void): void
}

export default function AboutView(props: AboutViewProps) {
    const modal = useModal()
    const token = AuthService.useToken()
    const handleCopyToken = () => {
        navigator.clipboard
            .writeText(token ?? "No token found!")
            .then(() => {
                void modal.info(
                    "Current token has been copied into the clipboard."
                )
            })
            .catch(console.error)
    }
    const [rendererVersion, setRendererVersion] = React.useState("...")
    const [backendVersion, setBackendVersion] = React.useState("...")
    const [plugins, setPlugins] = React.useState<string[]>([])
    const title = getTitle()
    useBraynsInformation(props, setRendererVersion, setPlugins)
    useBackendInformation(props.backend, setBackendVersion)
    return (
        <Dialog
            className={getClassNames(props)}
            hideCancel={true}
            labelOK="Close"
            title={title}
            onOK={props.onClose}
        >
            <div style={{ maxWidth: "480px" }}>
                <h1>Powered by Brayns renderer</h1>
                <div className="grid">
                    <div>Version</div>
                    <div>{rendererVersion}</div>
                    <div>Address</div>
                    <div>
                        {cleanUpAddress(props.renderer.jsonRpcService.address)}
                    </div>
                    <div>Plugins</div>
                    <div>
                        <ul>
                            {plugins.map((plugin) => (
                                <li key={plugin}>{plugin}</li>
                            ))}
                        </ul>
                    </div>
                </div>
                <h1>And the Circuit Studio Backend</h1>
                <div className="grid">
                    <div>Version</div>
                    <div>{backendVersion}</div>
                    <div>Address</div>
                    <div>{cleanUpAddress(props.backend.address)}</div>
                </div>
                <h1>Current user</h1>
                <Button
                    flat
                    label="Copy the current token"
                    onClick={handleCopyToken}
                />
            </div>
        </Dialog>
    )
}

function useBraynsInformation(
    { renderer: service }: AboutViewProps,
    setVersion: React.Dispatch<React.SetStateAction<string>>,
    setPlugins: React.Dispatch<React.SetStateAction<string[]>>
) {
    React.useEffect(() => {
        service
            .getVersion()
            .then(({ major, minor, patch, revision }) => {
                setVersion(`${major}.${minor}.${patch} (${revision})`)
            })
            .catch(console.error)
        service
            .getApplicationParameters()
            .then((params) => setPlugins(params.plugins))
            .catch(console.error)
    }, [service])
}

function getClassNames(props: AboutViewProps): string {
    const classNames = ["custom", "view-AboutView"]
    if (typeof props.className === "string") {
        classNames.push(props.className)
    }

    return classNames.join(" ")
}

/**
 * @returns The page title.
 */
function getTitle() {
    return document.title
}

function cleanUpAddress(address: URL): string {
    let cleanAddress = address.toString()
    // Handle both ws:// and wss:// for backward compatibility
    if (cleanAddress.startsWith("ws://"))
        cleanAddress = cleanAddress.substring("ws://".length).trim()
    else if (cleanAddress.startsWith("wss://"))
        cleanAddress = cleanAddress.substring("wss://".length).trim()
    while (cleanAddress.endsWith("/")) {
        cleanAddress = cleanAddress.substring(0, cleanAddress.length - 1)
    }
    return cleanAddress
}

function useBackendInformation(
    backend: BackendManagerInterface,
    setBackendVersion: React.Dispatch<React.SetStateAction<string>>
) {
    React.useEffect(() => {
        const action = async () => {
            try {
                const version = await backend.service.exec("version")
                assertType<{ version: string }>(version, { version: "string" })
                setBackendVersion(version.version)
                const endpoints = await backend.service.exec("registry")
                console.log("🚀 [about-view] registry = ", endpoints) // @FIXME: Remove this line written on 2023-09-27 at 11:39
            } catch (ex) {
                console.error("Unable to query the Backend!", ex)
            }
        }
        void action()
    }, [])
}
