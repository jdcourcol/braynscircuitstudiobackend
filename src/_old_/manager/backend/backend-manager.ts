import JsonRpcService from "../../service/json-rpc/json-rpc-service"
import { TriggerableEventInterface } from "@/_old_/contract/tool/event"
import {
    assertArray,
    assertObject,
    assertType,
    isObject,
    isString,
} from "@/_old_/tool/validator"
import BackendManagerInterface, {
    FileSystemDirectoryContent,
    FileSystemDirectoryItem,
    FileSystemFileItem,
} from "@/_old_/contract/manager/backend"
import JsonRpcServiceInterface, {
    JsonRpcServiceAddress,
} from "@/_old_/contract/service/json-rpc"

interface FsExistsResponse {
    exists: boolean
    type: string | null
}

export default class BackendManager implements BackendManagerInterface {
    private _initialized = false
    private _service: JsonRpcServiceInterface | undefined = undefined

    constructor(
        public readonly address: JsonRpcServiceAddress,
        private readonly makeEvent: <T>() => TriggerableEventInterface<T>
    ) {}

    async connect(): Promise<void> {
        if (this._initialized) return
        try {
            const service = new JsonRpcService(this.address, this.makeEvent)
            await service.connect()
            this._service = service
            this._initialized = true
        } catch (ex) {
            console.error("Unable to connect backend:", ex)
            throw Error(
                `Unable to connect Backend at\n${this.address.toString()}!`
            )
        }
    }

    public get service(): JsonRpcServiceInterface {
        if (!this._service)
            throw Error("Backend service has not yet been initialized!")

        return this._service
    }

    async fsSetContent(
        path: string,
        content: string,
        base64: boolean
    ): Promise<void> {
        const { service } = this
        await service.exec("fs-upload-content", { path, base64, content })
    }

    async fsGetContent(path: string, base64: boolean): Promise<string> {
        const { service } = this
        const data = await service.exec("fs-get-content", { path, base64 })
        if (isString(data)) return data

        console.error("fs-get-content should return a string!", data)
        throw Error("fs-get-content should return a string!")
    }

    async fsGetRootDir(): Promise<string> {
        // Mocked to return /mnt instead of calling fs-get-root
        return "/mnt"
    }

    async fsListDir(path: string): Promise<FileSystemDirectoryContent> {
        const { service } = this
        const data = await service.exec("fs-list-dir", { path })
        assertObject(data, "fs-list-dir")
        const { directories, files } = data
        assertArray(directories, "fs-list-dir.directories")
        assertArray(files, "fs-list-dir.files")
        return {
            directories: (directories as FileSystemDirectoryItem[]).map(
                (directory) => directory.name
            ),
            files: files as FileSystemFileItem[],
        }
    }

    async fsExists(path: string): Promise<boolean> {
        // fs-exists API call disabled - returning false
        // This will prevent file existence checks but may affect file browser functionality
        return false
    }

    async fsIsDirectory(path: string): Promise<boolean> {
        // fs-exists API call disabled - returning false
        // This will prevent directory existence checks but may affect file browser functionality
        return false
    }

    async fsIsFile(path: string): Promise<boolean> {
        // fs-exists API call disabled - returning false
        // This will prevent file existence checks but may affect file browser functionality
        return false
    }

    async listNodeSets(circuitPath: string): Promise<string[]> {
        const { service } = this
        const response = await service.exec("sonata-get-node-sets", {
            path: circuitPath,
        })
        assertType<{ node_sets: string[] }>(response, {
            node_sets: ["array", "string"],
        })
        return response.node_sets
    }

    async volumeParseHeader(path: string): Promise<Record<string, string>> {
        const { service } = this
        const response = await service.exec("volume-parse-header", { path })
        assertType(response, ["map", "string"])
        return response as Record<string, string>
    }
}
