import AtlasServiceInterface from "@/_old_/contract/service/atlas"
import NexusInterface from "@/_old_/contract/service/nexus"
import { LimitedStringCacheMap } from "@/_old_/tool/cache-map"
import { assertType } from "@/_old_/tool/validator"

const NEXUS_FILES_URL = "https://bbp.epfl.ch/nexus/v1/files/bbp/atlas/"
const NEXUS_VIEWS_URL = "https://bbp.epfl.ch/nexus/v1/views/bbp/atlas/"

export default class Nexus extends NexusInterface {
    private readonly promisedRegionUrlMap: Promise<Map<number, string>>

    private static readonly cache = new LimitedStringCacheMap(100e6)

    constructor(
        private readonly token: string,
        private readonly atlas: AtlasServiceInterface
    ) {
        super()
        this.token = token
        this.promisedRegionUrlMap = loadMeshesMapping(token)
    }

    async loadMeshForRegion(regionId: number): Promise<string> {
        try {
            this.atlas.setBusy(regionId, true)
            const regionUrls = await this.promisedRegionUrlMap
            const { token } = this
            const url =
                regionUrls.get(regionId) ??
                `${NEXUS_FILES_URL}00d2c212-fa1d-4f85-bd40-0bc217807f5b`
            try {
                return await Nexus.cache.get(url, async () => {
                    const response = await fetch(url, {
                        headers: {
                            Accept: "*/*",
                            Authorization: `Bearer ${token}`,
                        },
                    })
                    if (!response.ok) {
                        throw Error(
                            `HTTP error code is ${response.status} (${response.statusText})!`
                        )
                    }
                    const content = await response.text()
                    return content
                })
            } catch (ex) {
                console.error("Unable to fetch mesh from:", url)
                console.error(ex)
                throw ex
            }
        } finally {
            this.atlas.setBusy(regionId, false)
        }
    }
}

async function loadMeshesMapping(token: string): Promise<Map<number, string>> {
    // Nexus API call disabled - returning empty map
    // Original call was to: https://bbp.epfl.ch/nexus/v1/views/bbp/atlas/https%3A%2F%2Fbbp.epfl.ch%2Fneurosciencegraph%2Fdata%2F420e53b8-db21-4f70-a534-d799c4b59b5d/_search
    return new Map<number, string>()
}
