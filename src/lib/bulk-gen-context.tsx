'use client'

import React, { createContext, useContext, useRef, useState, useCallback } from 'react'

interface BulkGenState {
    running: boolean
    total: number
    done: number
    label: string  // e.g. table name
}

interface BulkGenContextValue {
    state: BulkGenState
    start: (total: number, label: string) => void
    tick: () => void          // call after each post is created
    finish: () => void
    stop: () => void
    isStopped: () => boolean  // read stop flag in loop
}

const INIT: BulkGenState = { running: false, total: 0, done: 0, label: '' }

const BulkGenContext = createContext<BulkGenContextValue>({
    state: INIT,
    start: () => { },
    tick: () => { },
    finish: () => { },
    stop: () => { },
    isStopped: () => false,
})

export function BulkGenProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<BulkGenState>(INIT)
    const stoppedRef = useRef(false)

    const start = useCallback((total: number, label: string) => {
        stoppedRef.current = false
        setState({ running: true, total, done: 0, label })
    }, [])

    const tick = useCallback(() => {
        setState(prev => ({ ...prev, done: prev.done + 1 }))
    }, [])

    const finish = useCallback(() => {
        setState(prev => ({ ...prev, running: false }))
        // Auto-clear after 3s
        setTimeout(() => setState(INIT), 3000)
    }, [])

    const stop = useCallback(() => {
        stoppedRef.current = true
        setState(prev => ({ ...prev, running: false }))
        setTimeout(() => setState(INIT), 3000)
    }, [])

    const isStopped = useCallback(() => stoppedRef.current, [])

    return (
        <BulkGenContext.Provider value={{ state, start, tick, finish, stop, isStopped }}>
            {children}
        </BulkGenContext.Provider>
    )
}

export function useBulkGen() {
    return useContext(BulkGenContext)
}
