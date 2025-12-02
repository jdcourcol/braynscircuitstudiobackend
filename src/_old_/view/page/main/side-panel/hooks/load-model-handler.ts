import {
    CellPlacementModel,
    CircuitModelBbp,
} from "@/_old_/contract/manager/models"
import { VolumeModel } from "@/_old_/contract/manager/models/types/volume-model"
import { ensureSceneManagerInterface } from "@/_old_/contract/manager/scene"
import SceneManagerInterface from "@/_old_/contract/manager/scene/scene-manager"
import { LongTask } from "@/_old_/contract/service/json-rpc"
import { useCancellableTaskHandler } from "@/_old_/tool/hooks/cancellable-task-handler"
import { useServiceLocator } from "@/_old_/tool/locator"
import { useModal } from "@/_old_/ui/modal"
import {
    useAskLoaderParamsForCellPlacement,
    useAskLoaderParamsForCircuitBbp,
    useAskLoaderParamsForCircuitSonata,
    useAskLoaderParamsForVolume,
} from "@/_old_/user-input/model-loader-params/model-loader-params"
import { useAskFilename } from "@/_old_/user-input/path/filename"
import React from "react"
import {
    isPathOfBbpCircuitOrSimulation,
    isPathOfCellMorphology,
    isPathOfCellPlacement,
    isPathOfGenericMesh,
    isPathOfSonataFile,
    isPathOfVolume,
} from "../handler/guess-file-type"
import { bubbleError } from "../../../../../tool/error"

export function useLoadModelHandler() {
    const modal = useModal()
    const taskHandler = useCancellableTaskHandler()
    const askFilename = useAskFilename()
    const askLoaderParamsForCircuitBbp = useAskLoaderParamsForCircuitBbp()
    const askLoaderParamsForCircuitSonata = useAskLoaderParamsForCircuitSonata()
    const askLoaderParamsForCellPlacement = useAskLoaderParamsForCellPlacement()
    const askLoaderParamsForVolume = useAskLoaderParamsForVolume()
    const { scene } = useServiceLocator({
        scene: ensureSceneManagerInterface,
    })
    return React.useCallback(
        async (title: string, extensions?: string[]) => {
            try {
                // Hardcode path for "Circuits & Simulations"
                let path: string | null = null
                if (title === "Circuits & Simulations") {
                    path = "/home/courcol/Circuit/rCA1-CYLINDER-REF-1PC-8PV-08/circuit_config.json"
                } else {
                    path = await askFilename({
                        title: `${title ?? "Select a file to add to the scene"}${
                            extensions && extensions.length > 0
                                ? ` (${extensions
                                      .map((ext) =>
                                          ext.charAt(0) === "." ? `*${ext}` : ext
                                      )
                                      .join(", ")})`
                                : ""
                        }`,
                        filter: makeExtensionFilter(extensions),
                        storageKey: `Import(${title})`,
                    })
                }
                if (!path) return

                if (isPathOfSonataFile(path)) {
                    const modelInputs =
                        await askLoaderParamsForCircuitSonata(path)
                    if (!modelInputs) return false

                    for (const modelInput of modelInputs) {
                        const model = await scene.models.circuit.load(
                            modelInput,
                            taskHandler
                        )
                        if (!model) return false

                        await scene.focusOnModel(model.modelIds)
                    }
                    return true
                }
                if (isPathOfBbpCircuitOrSimulation(path))
                    return await loadBbpCircuit(
                        path,
                        scene,
                        taskHandler,
                        askLoaderParamsForCircuitBbp
                    )
                if (isPathOfVolume(path))
                    return await loadVolume(
                        path,
                        scene,
                        taskHandler,
                        askLoaderParamsForVolume
                    )
                if (isPathOfGenericMesh(path))
                    return loadGenericMesh(path, scene, taskHandler)
                if (isPathOfCellPlacement(path))
                    return await loadCellPlacement(
                        path,
                        scene,
                        taskHandler,
                        askLoaderParamsForCellPlacement
                    )
                if (isPathOfCellMorphology(path))
                    return await loadCellMorphology(path, scene, taskHandler)
                // Unknown file type.
                return false
            } catch (ex) {
                console.log("🚀 [load-model-handler] ex = ", ex) // @FIXME: Remove this line written on 2024-01-31 at 10:18
                void modal.error(ex)
                return false
            }
        },
        [taskHandler]
    )
}

async function loadGenericMesh(
    path: string,
    scene: SceneManagerInterface,
    taskHandler: (task: LongTask) => void
): Promise<boolean> {
    const mesh = await getModelFromPathOfGenericMesh(path, scene, taskHandler)
    if (!mesh) return false

    await scene.focusOnModel(mesh.modelIds)
    return true
}

async function loadCellPlacement(
    path: string,
    scene: SceneManagerInterface,
    taskHandler: (task: LongTask) => void,
    askLoaderParamsForCellPlacement: (
        path: string
    ) => Promise<CellPlacementModel | null>
): Promise<boolean> {
    try {
        const modelInput = await askLoaderParamsForCellPlacement(path)
        if (!modelInput) return false

        const model = await scene.models.cellPlacement.load(
            modelInput,
            taskHandler
        )
        if (!model) return false

        await scene.focusOnModel(model.modelIds)
        return true
    } catch (ex) {
        bubbleError("Error while loading Cell Placement file!", ex)
    }
}

async function loadCellMorphology(
    path: string,
    scene: SceneManagerInterface,
    taskHandler: (task: LongTask) => void
): Promise<boolean> {
    const mesh = await getModelFromPathOfCellMorphology(
        path,
        scene,
        taskHandler
    )
    if (!mesh) return false

    await scene.focusOnModel(mesh.modelIds)
    return true
}

async function loadVolume(
    path: string,
    scene: SceneManagerInterface,
    taskHandler: (task: LongTask) => void,
    askLoaderParamsForVolume: (path: string) => Promise<VolumeModel | null>
): Promise<boolean> {
    const modelInput = await askLoaderParamsForVolume(path)
    if (!modelInput) return false

    const model = await scene.models.volume.load(modelInput, taskHandler)
    if (!model) return false

    await scene.focusOnModel(model.modelIds)
    return true
}

async function loadBbpCircuit(
    path: string,
    scene: SceneManagerInterface,
    taskHandler: (task: LongTask) => void,
    askLoaderParamsForCircuitBbp: (
        path: string
    ) => Promise<CircuitModelBbp | null>
): Promise<boolean> {
    const modelInput = await askLoaderParamsForCircuitBbp(path)
    if (!modelInput) return false

    const model = await scene.models.circuit.load(modelInput, taskHandler)
    if (!model) return false

    await scene.focusOnModel(model.modelIds)
    return true
}

async function getModelFromPathOfCellMorphology(
    path: string,
    scene: SceneManagerInterface,
    taskHandler: (task: LongTask) => void
) {
    const morphology = await scene.models.morphology.load({ path }, taskHandler)
    return morphology
}

async function getModelFromPathOfGenericMesh(
    path: string,
    scene: SceneManagerInterface,
    taskHandler: (task: LongTask) => void
) {
    const mesh = await scene.models.mesh.load({ path }, taskHandler)
    return mesh
}

function makeExtensionFilter(
    extensions?: string[] | undefined
): (this: void, filename: string) => boolean {
    if (!extensions || extensions.length === 0) {
        return (name: string) =>
            isPathOfSonataFile(name) ||
            isPathOfBbpCircuitOrSimulation(name) ||
            isPathOfGenericMesh(name) ||
            isPathOfCellPlacement(name) ||
            isPathOfCellMorphology(name) ||
            isPathOfVolume(name)
    }
    return (name: string) => {
        for (const ext of extensions) {
            if (name.endsWith(ext)) return true
        }
        return false
    }
}
