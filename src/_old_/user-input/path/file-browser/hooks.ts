import * as React from "react"
import StorageInterface from "@/_old_/contract/storage/storage"
import { humanFriendlySort } from "@/_old_/tool/name-splitter/name-splitter"
import { isStringArray } from "@/_old_/tool/validator"

import FileSystemServiceInterface, {
    FileSystemItem,
} from "@/_old_/contract/service/file-system"
import { useModal } from "../../../ui/modal"

type FileSystemBrowsing = [
    directories: string[],
    files: FileSystemItem[],
    busy: boolean,
    error: string | null,
]

export function useFileSystemBrowsing(
    root: null | string,
    path: null | string,
    service: FileSystemServiceInterface,
    filter: (filename: string) => boolean
): FileSystemBrowsing {
    const modal = useModal()
    const [busy, setBusy] = React.useState(true)
    const [directories, setDirectories] = React.useState<string[]>([])
    const [files, setFiles] = React.useState<FileSystemItem[]>([])
    const [error, setError] = React.useState<string | null>(null)
    React.useEffect(() => {
        const asyncAction = async () => {
            if (!root || !path) return

            try {
                if (!path.startsWith(root)) {
                    // Out of the sandbox.
                    setError(
                        `You can only browse files inside the sandbox: "${root}"!`
                    )
                    return
                }
                setBusy(true)
                const dirPath: string | null = await getDirPath(service, path)
                if (!dirPath) {
                    setError("Folder not found or denied!")
                    return
                }
                const dirContent = await service.listDirectory(dirPath)
                setDirectories(
                    humanFriendlySort(
                        prependCurrentFolder(dirContent.directories, dirPath)
                    )
                )
                setFiles(dirContent.files.filter((file) => filter(file.name)))
            } catch (ex) {
                await modal.error(ex)
            } finally {
                setBusy(false)
            }
        }
        void asyncAction()
    }, [root, path])
    return [directories, files, busy, error]
}

export function useSandboxRootDirectory(service: FileSystemServiceInterface) {
    const [root, setRoot] = React.useState<null | string>(null)
    React.useEffect(() => {
        const asyncAction = async () => {
            try {
                const sandbox = await service.getRootDir()
                setRoot(sandbox)
            } catch (ex) {
                console.error("Unable to get the sandbox directory:", ex)
            }
        }
        void asyncAction()
    }, [service])
    return root
}

export function useFavouriteDirectories(
    root: null | string,
    persistenceService: StorageInterface,
    storageKey: string | undefined,
    setPath: (path: string) => void
): [
    favouriteDirectories: string[],
    addFavouriteDirectory: (directory: string) => void,
] {
    const [favouriteDirectories, setFavouriteDirectories] = React.useState<
        string[]
    >([])
    const key = `fileSystemBrowser-view-BrowserView/favouriteDirectories/${
        storageKey ?? "DEFAULT"
    }`
    React.useEffect(() => {
        if (!root) return

        persistenceService
            .load(key, [])
            .then((data) => {
                if (!isStringArray(data)) {
                    setPath(root)
                    return
                }
                setFavouriteDirectories(data)
                if (data.length > 0) {
                    const [firstFavouriteDirectory] = data
                    setPath(firstFavouriteDirectory)
                } else {
                    setPath(root)
                }
            })
            .catch(console.error)
    }, [root, persistenceService, storageKey])
    return [
        favouriteDirectories,
        (directory: string) => {
            const directories = [
                directory,
                ...favouriteDirectories.filter((dir) => dir !== directory),
            ]
            setFavouriteDirectories(directories)
            void persistenceService.save(key, directories)
        },
    ]
}

/**
 * Return `path` if it is an existing directory.
 * Otherwise, return its parent if it is an existing directory.
 * Otherwise, return `null`.
 * 
 * Since fs-exists is disabled, we try to list the directory instead.
 */
async function getDirPath(
    service: FileSystemServiceInterface,
    path: string
): Promise<string | null> {
    // Try to list the directory - if it succeeds, it's a valid directory
    try {
        await service.listDirectory(path)
        return path
    } catch (ex) {
        // If listing fails, try the parent directory
        const parent = service.getDirectoryParent(path)
        if (!parent) return null

        try {
            await service.listDirectory(parent)
            return parent
        } catch (ex2) {
            // Both failed, return null
            return null
        }
    }
}

function prependCurrentFolder(
    directories: string[],
    dirPath: string
): string[] {
    if (directories.length === 0) return [dirPath]
    return directories.map((dir) => `${dirPath}/${dir}`)
}
