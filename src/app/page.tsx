import { State } from "@/state"
import {
    ViewButton,
    ViewInputNumber,
    ViewInputText,
    ViewPanel,
    useModal,
    useThrowableAsyncCallback,
} from "@tolokoban/ui"
import React from "react"
import { authenticatedFetch } from "@/util/fetch"

import { goto } from "./routes"

import Styles from "./page.module.css"

export default function Page() {
    const modal = useModal()
    const [webserver, setWebserver] = State.beta.webserver.useState()
    const [radius, setRadius] = State.beta.radius.useState()
    const [busy, setBusy] = React.useState(false)
    const handleClick = useThrowableAsyncCallback(async () => {
        setBusy(true)
        State.beta.webserver.value = State.beta.webserver.value.trim()
        if (!State.beta.webserver.value.endsWith("/")) {
            State.beta.webserver.value += "/"
        }
        try {
            for (let i = 0; i < 4; i++) {
                const url = `${State.beta.webserver.value}simul.${i}.json`
                try {
                    const resp = await authenticatedFetch(url)
                    const data: unknown = await resp.json()
                    console.log("🚀 [page] data = ", data) // @FIXME: Remove this line written on 2024-06-13 at 13:01
                } catch (ex) {
                    const message =
                        ex instanceof Error ? ex.message : JSON.stringify(ex)
                    throw Error(`Unable to fetch from "${url}": ${message}`)
                }
            }
            goto("/movies/simul")
        } catch (ex) {
            const message =
                ex instanceof Error ? ex.message : JSON.stringify(ex)
            void modal.error(message)
        } finally {
            setBusy(false)
        }
    }, [])
    return (
        <ViewPanel
            className={Styles.main}
            fullsize
            color="neutral-1"
            display="flex"
            justifyContent="space-around"
            alignItems="center"
            flexWrap="wrap"
            gap="L"
            padding="L"
        >
            <ViewPanel
                color="neutral-5"
                padding="M"
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap="M"
            >
                <ViewInputText
                    value={webserver}
                    onChange={setWebserver}
                    label="Webserver address:"
                />
                <ViewInputNumber
                    value={radius}
                    onChange={setRadius}
                    label="Spheres radius:"
                />
                <ViewButton waiting={busy} onClick={handleClick}>
                    Compare Simulations
                </ViewButton>
                <p>
                    Use <code>PageUp</code> and <code>PageDown</code> to change
                    the radius of the spheres in the interactive viewer.
                </p>
                <p>Be patient: loading time can be long...</p>
            </ViewPanel>
            <ViewPanel color="neutral-5" padding="M">
                <p>
                    To make this work, you need to start a webserver on BB5,
                    like this:
                </p>
                <pre>
                    {[
                        `ssh bbpv1`,
                        `cd /gpfs/bbp.cscs.ch/home/petitjea/simul`,
                        `python3 serve.py 2711`,
                    ].join("\n")}
                </pre>
            </ViewPanel>
            <ViewPanel color="neutral-5" padding="M">
                <p>You can also use another simulation. For this, go there:</p>
                <pre>
                    {[
                        `ssh bbpv1`,
                        `cd /gpfs/bbp.cscs.ch/home/petitjea/simul`,
                        `vi webgl.py`,
                    ].join("\n")}
                </pre>
                <p>
                    Edit the <code>pathes</code> variable and put exactly 4
                    SONATA simulation files. You can put the same one several
                    times if you don't have 4 different files.
                    <br />
                    Then execute it like this:
                </p>
                <pre>
                    {[`. ./venv/bin/activate`, `python3 webgl.py`].join("\n")}
                </pre>
                <p>
                    Warning! Only the first <b>4000</b> steps will be loaded.
                </p>
            </ViewPanel>
        </ViewPanel>
    )
}
