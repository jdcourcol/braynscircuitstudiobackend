import FileSystemServiceInterface from "@/_old_/contract/service/file-system"
import StorageInterface from "@/_old_/contract/storage/storage"
import { useModal } from "@/_old_/ui/modal"
import Runnable from "@/_old_/ui/view/runnable"
import * as React from "react"
import DirListView from "./directories-list"
import "./file-browser-view.css"
import FilesListView from "./files-list"
import Header from "./header"
import {
    useFavouriteDirectories,
    useFileSystemBrowsing,
    useSandboxRootDirectory,
} from "./hooks"

// Default filter.
const SHOW_ALL = (_filename: string) => true

export interface BrowserViewProps {
    className?: string
    foldersOnly?: boolean
    storageKey?: string
    filter?(this: void, filename: string): boolean
    persistenceService: StorageInterface
    fileSystemService: FileSystemServiceInterface
    onFileSelect?(this: void, filePath: string): void
    onFolderSelect?(this: void, folderPath: string): void
}

export default function BrowserView(props: BrowserViewProps) {
    const modal = useModal()
    const [path, setPath] = React.useState<null | string>(null)
    const root = useSandboxRootDirectory(props.fileSystemService)
    const [directories, files, busy, error] = useFileSystemBrowsing(
        root,
        path,
        props.fileSystemService,
        props.filter ?? SHOW_ALL
    )
    const [favouriteDirectories, addFavouriteDirectory] =
        useFavouriteDirectories(
            root,
            props.persistenceService,
            props.storageKey,
            setPath
        )

    React.useEffect(() => {
        // Restore last path from the storage
        if (root && favouriteDirectories.length > 0) {
            setPath(favouriteDirectories[0])
        }
    }, [root])

    React.useEffect(() => {
        if (path) {
            addFavouriteDirectory(path)
        }
    }, [path])

    React.useEffect(() => {
        if (props.onFolderSelect && path) props.onFolderSelect(path)
    }, [favouriteDirectories])

    React.useEffect(() => {
        async function checkDir() {
            // Since fs-exists is disabled, we can't check if a path is a file
            // Skip this check - the file browser will handle it via getDirPath
            // which tries to list the directory instead
        }
        if (path !== null) {
            void checkDir()
        }
    }, [path])

    const handleFileSelect = React.useCallback((filePath: string) => {
        if (props.onFileSelect) props.onFileSelect(filePath)
    }, [])

    return (
        <div className={getClassNames(busy, props.className)}>
            <Header
                currentPath={path ?? ""}
                error={error}
                favouriteDirectories={favouriteDirectories}
                onDirectoryClick={setPath}
            />
            <Runnable running={busy}>
                <div className="grid">
                    <DirListView
                        rootDir={root}
                        currentPath={path ?? root}
                        directories={directories}
                        onClick={(value) => {
                            setPath(value)
                            if (props.onFolderSelect) {
                                addFavouriteDirectory(value)
                                props.onFolderSelect(value)
                            }
                        }}
                    />
                    {props.foldersOnly !== true && (
                        <FilesListView
                            files={files}
                            onClick={(file) => {
                                if (!root) return
                                const fullPath = `${path ?? root}/${file.name}`
                                handleFileSelect(fullPath)
                            }}
                        />
                    )}
                </div>
            </Runnable>
        </div>
    )
}

function getClassNames(loading: boolean, className?: string): string {
    const classNames = ["custom", "fileSystemBrowser-view-BrowserView"]
    if (typeof className === "string") {
        classNames.push(className)
    }
    if (loading) classNames.push("loading")

    return classNames.join(" ")
}
