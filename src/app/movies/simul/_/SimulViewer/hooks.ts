import React from "react"
import { SimulData } from "./types"
import { useThrowableAsyncEffect } from "@tolokoban/ui"
import { assertType } from "@tolokoban/type-guards"
import {
    TgdCamera,
    TgdCameraPerspective,
    TgdContext,
    TgdControllerCameraOrbit,
    TgdPainterClear,
    TgdPainterDepth,
} from "@tolokoban/tgd"
import { PainterSimulation } from "./painter/simul-painter"
import { ActiveValue } from "../active-value"
import { State } from "@/state"
import { authenticatedFetch } from "@/util/fetch"

export function useMountCanvasHandler(
    step: ActiveValue<number>,
    index: number
): (
    canvas: HTMLCanvasElement | null,
    data: SimulData | null,
    camera: TgdCamera
) => void {
    const refContext = React.useRef<TgdContext | null>(null)
    const refPainter = React.useRef<PainterSimulation | null>(null)
    const refOrbiter = React.useRef<TgdControllerCameraOrbit | null>(null)
    React.useEffect(() => {
        const action = () => {
            const painter = refPainter.current
            if (painter) painter.step = shift(step.value, index)
        }
        action()
        step.event.addListener(action)
        return () => step.event.removeListener(action)
    }, [step])
    return React.useCallback(
        (
            canvas: HTMLCanvasElement | null,
            data: SimulData | null,
            camera: TgdCamera
        ) => {
            if (!canvas || !data) return

            if (refContext.current) {
                if (refContext.current.canvas === canvas) return

                refContext.current.pause()
                refContext.current.destroy()
            }
            if (refOrbiter.current) {
                refOrbiter.current.detach()
            }
            const context = new TgdContext(canvas, {
                depth: true,
                antialias: true,
            })
            refOrbiter.current = new TgdControllerCameraOrbit(context, {
                inertiaOrbit: 900,
            })
            refContext.current = context
            context.camera = camera
            const painter = new PainterSimulation(
                context,
                data.dataCoords,
                data.dataReport
            )
            refPainter.current = painter
            context.add(
                new TgdPainterClear(context, {
                    color: [0.0627, 0.149, 0.3725, 1],
                    depth: 1,
                }),
                new TgdPainterDepth(context, {
                    enabled: true,
                }),
                painter
            )
            context.play()
        },
        [step]
    )
}

export function useSimulData(index: number): SimulData | null {
    const [simulData, setSimulData] = React.useState<SimulData | null>(null)
    useThrowableAsyncEffect(async () => {
        const [info, dataCoords, dataReport] = await Promise.all([
            loadSimulInfo(`simul.${index}.json`),
            loadFloat32Array(`coords.${index}.dat`),
            loadFloat32Array(`report.${index}.dat`),
        ])
        setSimulData({
            dataCoords,
            dataReport, // : fakeReport(dataCoords, dataReport),
            bounds: {
                x: info.x,
                y: info.y,
                z: info.z,
                v: info.v,
            },
        })
    }, [])
    return simulData
}

export function useCamera(): TgdCamera {
    const camera = React.useMemo(
        () =>
            new TgdCameraPerspective({
                fovy: Math.PI / 4,
                near: 1,
                far: 100000,
            }),
        []
    )
    useThrowableAsyncEffect(async () => {
        const info = await loadSimulInfo("simul.0.json")
        const [xMin, xMax] = info.x
        const x = 0.5 * (xMin + xMax)
        const [yMin, yMax] = info.y
        const y = 0.5 * (yMin + yMax)
        const [zMin, zMax] = info.z
        const z = 0.5 * (zMin + zMax)
        camera.setTarget(x, y, z)
        camera.distance = Math.max(Math.abs(xMax - xMin), Math.abs(yMax - yMin))
    }, [])
    return camera
}

interface SimulInfo {
    stepsCount: number
    startTime: number
    endTime: number
    stepTime: number
    x: [min: number, max: number]
    y: [min: number, max: number]
    z: [min: number, max: number]
    v: [min: number, max: number]
}

async function loadSimulInfo(url: string): Promise<SimulInfo> {
    const resp = await authenticatedFetch(`${State.beta.webserver.value}${url}`)
    const data: unknown = await resp.json()
    assertType<SimulInfo>(data, {
        stepsCount: "number",
        startTime: "number",
        endTime: "number",
        stepTime: "number",
        x: ["array(2)", "number"],
        y: ["array(2)", "number"],
        z: ["array(2)", "number"],
        v: ["array(2)", "number"],
    })
    return data
}

async function loadFloat32Array(url: string): Promise<Float32Array> {
    const resp = await authenticatedFetch(`${State.beta.webserver.value}${url}`)
    const data = await resp.arrayBuffer()
    return new Float32Array(data)
}

function fakeReport(dataCoords: Float32Array, dataReport: Float32Array) {
    const cells = Math.floor(dataCoords.length / 3)
    const steps = Math.floor(dataReport.length / cells)
    let i = 0
    const result = new Float32Array(dataReport.length)
    for (let s = 0; s < steps; s++) {
        for (let c = 0; c < cells; c++) {
            const x = dataCoords[c * 3 + 0]
            const y = dataCoords[c * 3 + 1]
            const z = dataCoords[c * 3 + 2]
            const a1 = Math.sqrt(Math.abs(x * y + z))
            const s1 = 3 * x + y - z
            const a2 = Math.sqrt(Math.abs(x - y * z))
            const s2 = 2 * x - y + z
            const t = s * 0.00001
            let v = Math.cos(t * a1 + s1) + Math.cos(t * a2 + s2)
            if (v < 1) v = 1
            result[i++] = v - 1
        }
    }
    return result
}

function distort(
    value: number,
    ranges: Array<[min: number, max: number]>
): number {
    for (const [min, max] of ranges) {
        if (value > min && value < max) {
            const x = (value - min) / (max - min)
            const y = 0.5 * Math.sin(x * Math.PI) + x
            return Math.floor(min + (max - min) * y)
        }
    }
    return value
}

const RANGES: Array<Array<[min: number, max: number]>> = [
    [[1047, 1511]],
    [[3000, 4000]],
    [[1185, 1657]],
    [[945, 3244]],
]

function shift(value: number, index: number) {
    const ranges = RANGES[index]
    if (!ranges) return value

    return distort(value, ranges)
}
