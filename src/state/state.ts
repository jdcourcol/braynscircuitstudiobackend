import AtomicState from "@tolokoban/react-state"
import { isNumber, isString } from "@tolokoban/type-guards"

export const State = {
    service: {
        host: new AtomicState<string | null>(null, {
            storage: {
                id: "service/host",
                guard: isString,
            },
        }),
        portBrayns: new AtomicState(5000, {
            storage: {
                id: "service/portBrayns",
                guard: isNumber,
            },
        }),
        portBackend: new AtomicState(8000, {
            storage: {
                id: "service/portBackend",
                guard: isNumber,
            },
        }),
    },
    beta: {
        webserver: new AtomicState("/simul/", {
            storage: {
                id: "beta/webserver",
                guard: isString,
            },
        }),
        radius: new AtomicState(100, {
            storage: {
                id: "beta/radius",
                guard: isNumber,
            },
        }),
        authToken: new AtomicState<string | null>(null, {
            storage: {
                id: "beta/authToken",
                guard: (value): value is string | null =>
                    value === null || isString(value),
            },
        }),
    },
}
