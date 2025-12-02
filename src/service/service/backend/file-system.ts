import { assertString, assertType } from "@tolokoban/type-guards"
import JsonRpcService from "../json-rpc"

export class FileSystem {
    private _rootPath: string | null = null

    constructor(private readonly getBackend: () => JsonRpcService) {}

    async getRootPath(): Promise<string> {
        if (this._rootPath) return this._rootPath

        // Mocked to return /mnt instead of calling fs-get-root
        this._rootPath = "/mnt"
        return this._rootPath
    }

    async listDir(path: string): Promise<{
        files: Array<{
            name: string
            path: string
            size: number
        }>
        directories: Array<{
            name: string
            path: string
        }>
    }> {
        const backend = this.getBackend()
        const data = await backend.exec("fs-list-dir", { path })
        assertType<{
            files?: Array<{
                name: string
                path: string
                size: number
            }>
            directories?: Array<{
                name: string
                path: string
            }>
        }>(data, {
            files: [
                "?",
                [
                    "array",
                    {
                        name: "string",
                        path: "string",
                        size: "number",
                    },
                ],
            ],
            directories: [
                "?",
                [
                    "array",
                    {
                        name: "string",
                        path: "string",
                    },
                ],
            ],
        })
        return {
            files: data.files ?? [],
            directories: data.directories ?? [],
        }
    }
}
