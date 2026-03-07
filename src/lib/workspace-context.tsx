'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react'

const STORAGE_KEY = 'asocial_workspace'
const SWITCH_DELAY_MS = 350  // duration of the transition

interface WorkspaceChannel {
    id: string
    displayName: string
    name: string
    timezone?: string
    avatarUrl?: string | null
}

interface WorkspaceContextType {
    activeChannelId: string | null
    activeChannel: WorkspaceChannel | null
    channels: WorkspaceChannel[]
    setActiveChannel: (channel: WorkspaceChannel | null) => void
    loadingChannels: boolean
    isSwitching: boolean  // true briefly when workspace changes
}

const WorkspaceContext = createContext<WorkspaceContextType>({
    activeChannelId: null,
    activeChannel: null,
    channels: [],
    setActiveChannel: () => { },
    loadingChannels: true,
    isSwitching: false,
})

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [channels, setChannels] = useState<WorkspaceChannel[]>([])
    const [activeChannel, setActiveChannelState] = useState<WorkspaceChannel | null>(null)
    const [loadingChannels, setLoadingChannels] = useState(true)
    const [isSwitching, setIsSwitching] = useState(false)
    const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const res = await fetch('/api/admin/channels')
                if (res.ok) {
                    const data: WorkspaceChannel[] = await res.json()
                    setChannels(data)
                    const saved = localStorage.getItem(STORAGE_KEY)
                    if (saved) {
                        const found = data.find((c) => c.id === saved)
                        if (found) {
                            setActiveChannelState(found)
                        } else if (data.length > 0) {
                            // Saved channel no longer exists — default to first
                            setActiveChannelState(data[0])
                            localStorage.setItem(STORAGE_KEY, data[0].id)
                        }
                    } else if (data.length > 0) {
                        // No saved channel — default to first
                        setActiveChannelState(data[0])
                        localStorage.setItem(STORAGE_KEY, data[0].id)
                    }
                }
            } catch { /* silently ignore */ } finally {
                setLoadingChannels(false)
            }
        }
        fetchChannels()
    }, [])

    const setActiveChannel = useCallback((channel: WorkspaceChannel | null) => {
        // Trigger switching animation
        setIsSwitching(true)
        if (switchTimer.current) clearTimeout(switchTimer.current)
        switchTimer.current = setTimeout(() => setIsSwitching(false), SWITCH_DELAY_MS)

        setActiveChannelState(channel)
        if (channel) {
            localStorage.setItem(STORAGE_KEY, channel.id)
        } else {
            localStorage.removeItem(STORAGE_KEY)
        }
    }, [])

    return (
        <WorkspaceContext.Provider
            value={{
                activeChannelId: activeChannel?.id ?? null,
                activeChannel,
                channels,
                setActiveChannel,
                loadingChannels,
                isSwitching,
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    )
}

export function useWorkspace() {
    return useContext(WorkspaceContext)
}
