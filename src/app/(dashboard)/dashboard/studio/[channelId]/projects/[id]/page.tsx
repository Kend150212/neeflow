'use client'

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
    ReactFlow,
    addEdge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    type Connection,
    type NodeTypes,
    type Node,
    BackgroundVariant,
    Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
    ChevronLeft, Save, Play, Loader2,
    Image as ImageIcon, Plus, ExternalLink,
    CheckCircle2, AlertCircle, Clock, User, Type,
    ShoppingBag, ArrowUpCircle, Scissors, Video, Send,
    UserRound, Paintbrush2, Eraser, Layers, ScanLine,
    Crop, MessageSquareText, AudioLines,
    Shirt, Gem,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { AvatarNode } from '@/components/studio/nodes/AvatarNode'
import { PromptNode } from '@/components/studio/nodes/PromptNode'
import { ProductNode } from '@/components/studio/nodes/ProductNode'
import { ImageGenNode } from '@/components/studio/nodes/ImageGenNode'
import { UpscaleNode } from '@/components/studio/nodes/UpscaleNode'
import { BgRemoveNode } from '@/components/studio/nodes/BgRemoveNode'
import { VideoGenNode } from '@/components/studio/nodes/VideoGenNode'
import { FaceSwapNode } from '@/components/studio/nodes/FaceSwapNode'
import { Img2ImgNode } from '@/components/studio/nodes/Img2ImgNode'
import { InpaintNode } from '@/components/studio/nodes/InpaintNode'
import { TextOverlayNode } from '@/components/studio/nodes/TextOverlayNode'
import { IPAdapterNode } from '@/components/studio/nodes/IPAdapterNode'
import { ControlNetNode } from '@/components/studio/nodes/ControlNetNode'
import { CropResizeNode } from '@/components/studio/nodes/CropResizeNode'
import { CaptionGenNode } from '@/components/studio/nodes/CaptionGenNode'
import { LipSyncNode } from '@/components/studio/nodes/LipSyncNode'

interface StudioAvatar {
    id: string; name: string; coverImage: string | null; prompt: string; style: string
}
interface StudioAvatarAsset {
    id: string; type: string; name: string; prompt: string | null
    images: Array<{ url: string; label?: string }>
}
interface StudioOutput {
    id: string; url: string; type: string; prompt: string | null; createdAt: string
    metadata: { model?: string; size?: string } | null
    pushedToPost?: boolean
}
interface StudioProject {
    id: string; name: string; description: string | null; status: string
    workflow: { nodesJson: unknown[]; edgesJson: unknown[] } | null
    outputs: StudioOutput[]
    jobs: Array<{ id: string; status: string; createdAt: string; finishedAt: string | null }>
}

const makeDefaultNodes = () => [
    { id: 'avatar-1', type: 'avatarNode', position: { x: 80, y: 80 }, data: {} },
    { id: 'prompt-1', type: 'promptNode', position: { x: 80, y: 260 }, data: { prompt: '' } },
    { id: 'imagegen-1', type: 'imageGenNode', position: { x: 420, y: 140 }, data: { model: 'fal-ai/flux/schnell', imageSize: 'landscape_4_3', numImages: 1 } },
]
const DEFAULT_EDGES = [
    { id: 'e-avatar-img', source: 'avatar-1', target: 'imagegen-1', targetHandle: 'avatar', animated: true, style: { stroke: '#34d399' } },
    { id: 'e-prompt-img', source: 'prompt-1', target: 'imagegen-1', targetHandle: 'prompt', animated: true, style: { stroke: '#a78bfa' } },
]

export default function ProjectCanvasPage() {
    const { channelId, id } = useParams<{ channelId: string; id: string }>()
    const { t } = useI18n()
    const [project, setProject] = useState<StudioProject | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [running, setRunning] = useState(false)
    const [rightTab, setRightTab] = useState<'outputs' | 'history'>('outputs')
    const [avatars, setAvatars] = useState<StudioAvatar[]>([])
    const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
    const [avatarPickerNodeId, setAvatarPickerNodeId] = useState<string | null>(null)
    // Outfit / Accessory picker
    const [outfitPickerOpen, setOutfitPickerOpen] = useState(false)
    const [outfitPickerNodeId, setOutfitPickerNodeId] = useState<string | null>(null)
    const [outfitPickerMode, setOutfitPickerMode] = useState<'outfit' | 'accessory' | 'prop'>('outfit')
    const [avatarAssets, setAvatarAssets] = useState<StudioAvatarAsset[]>([])
    const [outfitTab, setOutfitTab] = useState<'outfit' | 'accessory' | 'prop'>('outfit')
    const [selectedOutputs, setSelectedOutputs] = useState<Set<string>>(new Set())
    const [pushing, setPushing] = useState(false)
    const [enhancingNode, setEnhancingNode] = useState<string | null>(null)

    const [nodes, setNodes, onNodesChange] = useNodesState(makeDefaultNodes() as Node[])
    const [edges, setEdges, onEdgesChange] = useEdgesState(DEFAULT_EDGES as never[])
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const runningRef = useRef(running)
    useEffect(() => { runningRef.current = running }, [running])

    // Stable refs so handleDeleteNode / withDelete / nodeTypes NEVER change identity
    // ── this is the root fix for PromptNode focus-loss-on-keypress ──
    const setNodesRef = useRef(setNodes)
    const setEdgesRef = useRef(setEdges)
    useEffect(() => { setNodesRef.current = setNodes }, [setNodes])
    useEffect(() => { setEdgesRef.current = setEdges }, [setEdges])

    const updateNodeData = useCallback((nodeId: string, updates: Record<string, unknown>) => {
        setNodesRef.current(nds => nds.map(n =>
            n.id === nodeId ? { ...n, data: { ...(n.data as Record<string, unknown>), ...updates } } : n
        ) as Node[])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleOpenAvatarPicker = useCallback((nodeId: string) => {
        setAvatarPickerNodeId(nodeId)
        setAvatarPickerOpen(true)
    }, [])

    const handleOpenOutfitPicker = useCallback((nodeId: string, mode: 'outfit' | 'accessory' | 'prop' = 'outfit') => {
        setOutfitPickerNodeId(nodeId)
        setOutfitPickerMode(mode)
        setOutfitTab(mode)
        setOutfitPickerOpen(true)
    }, [])

    const handleOpenAccessoryPicker = useCallback((nodeId: string) => {
        handleOpenOutfitPicker(nodeId, 'accessory')
    }, [handleOpenOutfitPicker])

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleDeleteNode = useCallback((nodeId: string) => {
        setNodesRef.current(nds => nds.filter(n => n.id !== nodeId) as Node[])
        setEdgesRef.current(eds => (eds as Array<{ source: string; target: string; id: string }>).filter(e => e.source !== nodeId && e.target !== nodeId) as never[])
    }, [])

    // HOC: wraps any node with a hover-activated × delete button
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withDelete = useCallback((Component: React.ComponentType<any>) => (props: any) => (
        <div className="group/node relative">
            <button
                className="nodrag absolute -top-2.5 -right-2.5 z-50 w-5 h-5 rounded-full bg-red-500 border border-[#080d0b] flex items-center justify-center opacity-0 group-hover/node:opacity-100 transition-opacity hover:bg-red-400 shadow-md"
                style={{ pointerEvents: 'all' }}
                title="Delete node"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); e.preventDefault(); handleDeleteNode(props.id) }}
            >
                <span className="text-white text-[10px] font-bold leading-none select-none">×</span>
            </button>
            <Component {...props} />
        </div>
    ), [handleDeleteNode])


    // Stable ref for nodes (read in handleAISuggest without subscribing)
    const nodesRef = useRef(nodes)
    useEffect(() => { nodesRef.current = nodes }, [nodes])

    const channelIdRef = useRef(channelId)
    useEffect(() => { channelIdRef.current = channelId }, [channelId])

    // AI Suggest for PromptNode
    const handleAISuggestRef = useRef<(nodeId: string) => void>(() => { })
    const handleAISuggest = useCallback(async (nodeId: string) => {
        setEnhancingNode(nodeId)
        try {
            // Find avatar + product context from connected nodes
            const currentNodes = nodesRef.current
            const promptNode = currentNodes.find(n => n.id === nodeId)
            const avatarNode = currentNodes.find(n => n.type === 'avatarNode')
            const productNode = currentNodes.find(n => n.type === 'productNode')

            const avatarData = avatarNode?.data as Record<string, string> | undefined
            const productData = productNode?.data as Record<string, string | number> | undefined
            const currentPrompt = (promptNode?.data as Record<string, string>)?.prompt || ''

            const res = await fetch(`/api/studio/channels/${channelIdRef.current}/prompt-suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    avatarName: avatarData?.avatarName,
                    avatarPrompt: avatarData?.avatarPrompt,
                    productName: productData?.productName,
                    productDesc: String(productData?.description || ''),
                    platform: 'Instagram',
                    currentPrompt,
                }),
            })
            if (res.ok) {
                const { suggestions = [] } = await res.json()
                if (suggestions.length > 0) {
                    updateNodeData(nodeId, { prompt: suggestions[0], _suggestions: suggestions })
                    toast.success('AI suggestions generated! Click to cycle through them.')
                }
            } else {
                toast.error('Failed to generate suggestions')
            }
        } finally {
            setEnhancingNode(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateNodeData])
    useEffect(() => { handleAISuggestRef.current = handleAISuggest }, [handleAISuggest])

    const handleRun = useCallback(async () => {
        if (runningRef.current) return
        setRunning(true)
        try {
            // Save first
            setNodes(nds => {
                fetch(`/api/studio/channels/${channelId}/projects/${id}/workflow`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nodes: nds, edges }),
                }).catch(console.error)
                return nds
            })

            const res = await fetch(`/api/studio/channels/${channelId}/projects/${id}/run`, { method: 'POST' })
            if (res.ok) {
                toast.success('Generation started!')
                let attempts = 0
                const check = async () => {
                    attempts++
                    if (attempts > 60) { setRunning(false); return }
                    const r = await fetch(`/api/studio/channels/${channelId}/projects/${id}`)
                    if (r.ok) {
                        const data = await r.json()
                        const latest = data.project?.jobs?.[0]
                        if (latest?.status === 'done' || latest?.status === 'failed') {
                            setRunning(false)
                            setProject(data.project)
                            if (latest.status === 'done') toast.success('Image generated!')
                            else toast.error('Generation failed')
                        } else {
                            pollRef.current = setTimeout(check, 4000)
                        }
                    }
                }
                pollRef.current = setTimeout(check, 4000)
            } else {
                const data = await res.json()
                toast.error(data.error || 'Failed to start generation')
                setRunning(false)
            }
        } catch {
            setRunning(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, id])
    useEffect(() => { handleRunRef.current = handleRun }, [handleRun])

    // Push selected outputs to Compose as draft post

    const handlePushToPost = useCallback(async () => {
        if (!selectedOutputs.size) {
            toast.error('Select at least one output')
            return
        }
        setPushing(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/projects/${id}/push-to-post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outputIds: Array.from(selectedOutputs) }),
            })
            if (res.ok) {
                const data = await res.json()
                toast.success('Sent to Compose! Opening draft...')
                window.open(data.composeUrl, '_blank')
                setSelectedOutputs(new Set())
                // refresh to show pushedToPost badge
                fetchProject()
            } else {
                const data = await res.json()
                toast.error(data.error || 'Failed to push to post')
            }
        } finally {
            setPushing(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, id, selectedOutputs])

    // Stable refs for use inside nodeTypes (which must have [] deps)
    const enhancingNodeRef = useRef(enhancingNode)
    useEffect(() => { enhancingNodeRef.current = enhancingNode }, [enhancingNode])

    const handleRunRef = useRef<() => void>(() => { })

    // nodeTypes MUST be stable ([] deps) — never recreated so ReactFlow
    // never remounts node components, preserving textarea focus on every keystroke.
    // All dynamic state is read via refs at call-time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const nodeTypes = useMemo<NodeTypes>(() => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        avatarNode: withDelete((props: any) => (
            <AvatarNode {...props} data={{
                ...props.data,
                onSelect: () => handleOpenAvatarPicker(props.id),
                onSelectOutfit: () => handleOpenOutfitPicker(props.id, 'outfit'),
                onSelectAccessory: () => handleOpenAccessoryPicker(props.id),
            }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        promptNode: withDelete((props: any) => (
            <PromptNode {...props} data={{
                ...props.data,
                onChange: (val: string) => updateNodeData(props.id, { prompt: val }),
                onEnhance: () => handleAISuggestRef.current(props.id),
                enhancing: enhancingNodeRef.current === props.id,
            }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        productNode: withDelete((props: any) => (
            <ProductNode {...props} data={{ ...props.data, channelId: channelIdRef.current, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        imageGenNode: withDelete((props: any) => (
            <ImageGenNode {...props} data={{ ...props.data, running: runningRef.current, onRun: () => handleRunRef.current(), onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        upscaleNode: withDelete((props: any) => (
            <UpscaleNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bgRemoveNode: withDelete((props: any) => (
            <BgRemoveNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        videoGenNode: withDelete((props: any) => (
            <VideoGenNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        faceSwapNode: withDelete((props: any) => (
            <FaceSwapNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        img2imgNode: withDelete((props: any) => (
            <Img2ImgNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inpaintNode: withDelete((props: any) => (
            <InpaintNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        textOverlayNode: withDelete((props: any) => (
            <TextOverlayNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ipAdapterNode: withDelete((props: any) => (
            <IPAdapterNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        controlNetNode: withDelete((props: any) => (
            <ControlNetNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cropResizeNode: withDelete((props: any) => (
            <CropResizeNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        captionGenNode: withDelete((props: any) => (
            <CaptionGenNode {...props} data={{ ...props.data, channelId: channelIdRef.current, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lipSyncNode: withDelete((props: any) => (
            <LipSyncNode {...props} data={{ ...props.data, onChange: (key: string, val: unknown) => updateNodeData(props.id, { [key]: val }) }} />
        )),
        // ↓ INTENTIONALLY EMPTY — all dynamics read via refs at call-time
    }), [])


    useEffect(() => {
        fetchProject()
        fetchAvatars()
        return () => { if (pollRef.current) clearTimeout(pollRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, id])

    async function fetchProject() {
        setLoading(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/projects/${id}`)
            if (res.ok) {
                const data = await res.json()
                setProject(data.project)
                if (data.project.workflow) {
                    const wf = data.project.workflow
                    if ((wf.nodesJson as unknown[]).length > 0) setNodes(wf.nodesJson as Node[])
                    if ((wf.edgesJson as unknown[]).length > 0) setEdges(wf.edgesJson as never[])
                }
            }
        } finally { setLoading(false) }
    }

    async function fetchAvatars() {
        // Use channel-scoped API
        const res = await fetch(`/api/studio/channels/${channelId}/avatars`)
        if (res.ok) {
            const data = await res.json()
            // Combine own + shared avatars
            setAvatars([...(data.avatars || []), ...(data.sharedAvatars || [])])
        }
    }

    function selectAvatarForNode(avatar: StudioAvatar) {
        if (!avatarPickerNodeId) return
        updateNodeData(avatarPickerNodeId, {
            avatarId: avatar.id, avatarName: avatar.name,
            avatarCover: avatar.coverImage, avatarPrompt: avatar.prompt,
            // Reset outfit & accessory when switching avatar
            outfitId: undefined, outfitName: undefined, outfitImage: undefined,
            accessoryId: undefined, accessoryName: undefined, accessoryImage: undefined,
        })
        setAvatarPickerOpen(false)
        // Fetch assets for the newly selected avatar
        fetchAvatarAssets(avatar.id)
    }

    async function fetchAvatarAssets(avatarId: string) {
        const res = await fetch(`/api/studio/channels/${channelId}/avatars/${avatarId}/assets`)
        if (res.ok) {
            const data = await res.json()
            setAvatarAssets(data.assets || [])
        }
    }

    function selectOutfitForNode(asset: StudioAvatarAsset) {
        if (!outfitPickerNodeId) return
        const firstImage = (asset.images as Array<{ url: string }>)?.[0]?.url
        const isAccessory = outfitTab === 'accessory' || outfitTab === 'prop'
        if (isAccessory) {
            updateNodeData(outfitPickerNodeId, {
                accessoryId: asset.id, accessoryName: asset.name, accessoryImage: firstImage,
            })
        } else {
            updateNodeData(outfitPickerNodeId, {
                outfitId: asset.id, outfitName: asset.name, outfitImage: firstImage,
            })
        }
        setOutfitPickerOpen(false)
    }

    const onConnect = useCallback((connection: Connection) => {
        // Style edge based on target handle
        const edgeColor =
            connection.targetHandle === 'avatar' ? '#34d399' :
                connection.targetHandle === 'prompt' ? '#a78bfa' :
                    connection.targetHandle === 'product' ? '#fbbf24' : '#6b7280'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEdges(eds => addEdge({ ...(connection as any), animated: true, style: { stroke: edgeColor } }, eds as never[]) as never[])

        // When Product → ImageGen(product handle): copy product data into imageGen node
        if (connection.targetHandle === 'product' && connection.target && connection.source) {
            setNodes(nds => {
                const sourceNode = nds.find(n => n.id === connection.source)
                if (!sourceNode || sourceNode.type !== 'productNode') return nds
                const pd = sourceNode.data as Record<string, unknown>
                return nds.map(n =>
                    n.id === connection.target
                        ? { ...n, data: { ...n.data, productName: pd.productName, productImage: pd.productImage, productDescription: pd.description } }
                        : n
                ) as typeof nds
            })
        }
    }, [setEdges, setNodes])

    async function handleSave() {
        setSaving(true)
        try {
            await fetch(`/api/studio/channels/${channelId}/projects/${id}/workflow`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodes, edges }),
            })
            toast.success('Workflow saved')
        } finally { setSaving(false) }
    }

    function addNode(type: string) {
        const nodeId = `${type}-${Date.now()}`
        const newNode: Node = {
            id: nodeId, type,
            position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 80 },
            data: type === 'promptNode' ? { prompt: '' }
                : type === 'imageGenNode' ? { model: 'fal-ai/flux/schnell', imageSize: 'landscape_4_3', numImages: 1 }
                    : type === 'videoGenNode' ? { duration: 5, motion: 'subtle' }
                        : {},
        }
        setNodes(nds => [...nds, newNode])
    }

    const outputs = project?.outputs || []

    const NodeLibrary = [
        { type: 'avatarNode', icon: User, color: 'text-emerald-400 hover:bg-emerald-400/10', title: 'Avatar' },
        { type: 'promptNode', icon: Type, color: 'text-violet-400 hover:bg-violet-400/10', title: 'Prompt' },
        { type: 'productNode', icon: ShoppingBag, color: 'text-amber-400 hover:bg-amber-400/10', title: 'Product' },
        { type: 'imageGenNode', icon: ImageIcon, color: 'text-pink-400 hover:bg-pink-400/10', title: 'Image Gen' },
        { type: 'upscaleNode', icon: ArrowUpCircle, color: 'text-cyan-400 hover:bg-cyan-400/10', title: 'Upscale' },
        { type: 'bgRemoveNode', icon: Scissors, color: 'text-fuchsia-400 hover:bg-fuchsia-400/10', title: 'Rm BG' },
        { type: 'videoGenNode', icon: Video, color: 'text-orange-400 hover:bg-orange-400/10', title: 'Video' },
        { type: 'faceSwapNode', icon: UserRound, color: 'text-yellow-400 hover:bg-yellow-400/10', title: 'Face Swap' },
        { type: 'img2imgNode', icon: Paintbrush2, color: 'text-sky-400 hover:bg-sky-400/10', title: 'Img2Img' },
        { type: 'inpaintNode', icon: Eraser, color: 'text-rose-400 hover:bg-rose-400/10', title: 'Inpaint' },
        { type: 'textOverlayNode', icon: Type, color: 'text-lime-400 hover:bg-lime-400/10', title: 'Text' },
        { type: 'ipAdapterNode', icon: Layers, color: 'text-violet-400 hover:bg-violet-400/10', title: 'IP-Adapt' },
        { type: 'controlNetNode', icon: ScanLine, color: 'text-teal-400 hover:bg-teal-400/10', title: 'Control' },
        { type: 'cropResizeNode', icon: Crop, color: 'text-amber-400 hover:bg-amber-400/10', title: 'Crop' },
        { type: 'captionGenNode', icon: MessageSquareText, color: 'text-indigo-400 hover:bg-indigo-400/10', title: 'Caption' },
        { type: 'lipSyncNode', icon: AudioLines, color: 'text-orange-400 hover:bg-orange-400/10', title: 'Lip Sync' },
    ]

    return (
        <div className="flex h-screen overflow-hidden bg-[#080d0b]">
            {/* Left sidebar — node library */}
            <aside className="w-16 border-r border-white/5 flex flex-col items-center py-4 gap-1 bg-[#080d0b] shrink-0">
                <Link href={`/dashboard/studio/${channelId}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="h-px w-10 bg-white/10 my-1" />
                {NodeLibrary.map(item => (
                    <button
                        key={item.type}
                        onClick={() => addNode(item.type)}
                        title={item.title}
                        className={cn('w-14 py-2 rounded-lg flex flex-col items-center gap-1 transition-colors', item.color)}
                    >
                        <item.icon className="h-4 w-4" />
                        <span className="text-[9px] font-medium leading-none">{item.title}</span>
                    </button>
                ))}
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top header */}
                <header className="h-12 border-b border-white/5 bg-[#080d0b]/90 backdrop-blur-md flex items-center px-4 gap-3 shrink-0">
                    {loading
                        ? <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                        : <span className="text-sm font-bold text-white">{project?.name}</span>
                    }
                    <div className="ml-auto flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-slate-400 hover:text-white text-xs" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            {t('studio.canvas.save')}
                        </Button>
                        <Button size="sm" className="h-7 gap-1.5 bg-pink-400 text-[#080d0b] hover:bg-pink-300 font-bold text-xs shadow-[0_0_12px_rgba(244,114,182,0.3)]" onClick={handleRun} disabled={running}>
                            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                            {t('studio.canvas.run')}
                        </Button>
                    </div>
                </header>

                {/* Canvas */}
                <div className="flex-1 relative">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                        </div>
                    ) : (
                        <ReactFlow
                            nodes={nodes} edges={edges}
                            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                            onConnect={onConnect} nodeTypes={nodeTypes}
                            fitView deleteKeyCode="Delete"
                            style={{ background: '#080d0b' }}
                        >
                            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(0,255,149,0.06)" />
                            <Controls className="!bg-[#0f1a14] !border-white/10 [&>button]:!bg-[#0f1a14] [&>button]:!text-slate-400 [&>button:hover]:!text-white [&>button:hover]:!bg-white/10" />
                            <MiniMap
                                className="!bg-[#0a120d] !border-white/10"
                                nodeColor={(n) => {
                                    if (n.type === 'avatarNode') return '#34d399'
                                    if (n.type === 'promptNode') return '#a78bfa'
                                    if (n.type === 'productNode') return '#fbbf24'
                                    if (n.type === 'upscaleNode') return '#22d3ee'
                                    if (n.type === 'bgRemoveNode') return '#e879f9'
                                    if (n.type === 'videoGenNode') return '#fb923c'
                                    return '#f472b6'
                                }}
                            />
                            <Panel position="top-left" className="text-[10px] text-slate-600 select-none">
                                Drag to connect · Del to remove node
                            </Panel>
                        </ReactFlow>
                    )}
                </div>
            </div>

            {/* Right panel — Outputs + History */}
            <aside className="w-72 border-l border-white/5 bg-[#0a120d] flex flex-col shrink-0">
                <div className="flex border-b border-white/5 shrink-0">
                    {(['outputs', 'history'] as const).map(tab => (
                        <button key={tab} onClick={() => setRightTab(tab)}
                            className={cn('flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors',
                                rightTab === tab ? 'text-white border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'
                            )}>
                            {tab === 'outputs' ? `${t('studio.canvas.outputsTab')} (${outputs.length})` : t('studio.canvas.historyTab')}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {rightTab === 'outputs' ? (
                        outputs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                                <div className="w-12 h-12 rounded-xl bg-pink-400/10 border border-pink-400/20 flex items-center justify-center">
                                    <ImageIcon className="h-5 w-5 text-pink-400" />
                                </div>
                                <p className="text-xs text-slate-500 text-center">{t('studio.canvas.noOutputs')}<br />{t('studio.canvas.noOutputsDesc')}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    {outputs.map(out => (
                                        <div
                                            key={out.id}
                                            onClick={() => setSelectedOutputs(prev => {
                                                const next = new Set(prev)
                                                if (next.has(out.id)) next.delete(out.id)
                                                else next.add(out.id)
                                                return next
                                            })}
                                            className={cn(
                                                'group relative aspect-square rounded-lg overflow-hidden border transition-colors cursor-pointer',
                                                selectedOutputs.has(out.id)
                                                    ? 'border-emerald-400 ring-1 ring-emerald-400/40'
                                                    : 'border-white/10 hover:border-pink-400/40'
                                            )}
                                        >
                                            {out.type === 'video'
                                                ? <video src={out.url} className="w-full h-full object-cover" muted />
                                                : <img src={out.url} alt="" className="w-full h-full object-cover" />
                                            }
                                            {out.pushedToPost && (
                                                <div className="absolute top-1 left-1 bg-emerald-400 text-[#080d0b] text-[9px] font-bold px-1 rounded">SENT</div>
                                            )}
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-1.5">
                                                <span className="text-[9px] text-slate-400">{out.metadata?.model?.split('/').pop()}</span>
                                                <a href={out.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                                    <ExternalLink className="h-3.5 w-3.5 text-white" />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Send to Compose button */}
                                {selectedOutputs.size > 0 && (
                                    <Button
                                        onClick={handlePushToPost}
                                        disabled={pushing}
                                        size="sm"
                                        className="w-full gap-1.5 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold text-xs mt-2"
                                    >
                                        {pushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                        {t('studio.canvas.sendToCompose').replace('{count}', String(selectedOutputs.size))}
                                    </Button>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="space-y-2">
                            {(project?.jobs || []).map(job => (
                                <div key={job.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
                                    <div className="shrink-0">
                                        {job.status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                            : job.status === 'failed' ? <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                                                : job.status === 'running' ? <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                                                    : <Clock className="h-3.5 w-3.5 text-slate-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-white capitalize">{job.status}</p>
                                        <p className="text-[9px] text-slate-500">{new Date(job.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                            {(project?.jobs || []).length === 0 && (
                                <p className="text-xs text-slate-600 text-center py-8">{t('studio.canvas.noRuns')}</p>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* Avatar Picker Dialog */}
            <Dialog open={avatarPickerOpen} onOpenChange={setAvatarPickerOpen}>
                <DialogContent className="sm:max-w-lg bg-[#0f1a14] border-emerald-400/20">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <User className="h-5 w-5 text-emerald-400" /> {t('studio.canvas.selectAvatarTitle')}
                        </DialogTitle>
                    </DialogHeader>
                    {avatars.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <p className="text-slate-400 text-sm">{t('studio.canvas.noAvatarsYet')}</p>
                            <Link href={`/dashboard/studio/${channelId}/avatars`}>
                                <Button size="sm" className="gap-1.5 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold">
                                    <Plus className="h-3.5 w-3.5" /> {t('studio.canvas.createAvatar')}
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3 pt-1">
                            {avatars.map(av => (
                                <button key={av.id} onClick={() => selectAvatarForNode(av)}
                                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-white/10 hover:border-emerald-400/40 hover:bg-emerald-400/5 transition-all">
                                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                                        {av.coverImage
                                            ? <img src={av.coverImage} alt={av.name} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full bg-white/5 flex items-center justify-center"><User className="h-5 w-5 text-slate-600" /></div>
                                        }
                                    </div>
                                    <p className="text-[11px] font-medium text-white text-center truncate w-full">{av.name}</p>
                                    <p className="text-[9px] text-slate-500 capitalize">{av.style}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Outfit / Accessory Picker Dialog */}
            <Dialog open={outfitPickerOpen} onOpenChange={setOutfitPickerOpen}>
                <DialogContent className="sm:max-w-lg bg-[#0f1a14] border-emerald-400/20">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            {outfitPickerMode === 'accessory'
                                ? <><Gem className="h-5 w-5 text-violet-400" /> {t('studio.canvas.outfitPickerTitleAccessory')}</>
                                : <><Shirt className="h-5 w-5 text-amber-400" /> {t('studio.canvas.outfitPickerTitleOutfit')}</>}
                        </DialogTitle>
                    </DialogHeader>
                    {/* Tabs */}
                    <div className="flex gap-1 border-b border-white/10 mb-3">
                        {(['outfit', 'accessory', 'prop'] as const).map(tab => (
                            <button key={tab} onClick={() => setOutfitTab(tab)}
                                className={cn(
                                    'px-3 py-1.5 text-xs font-semibold capitalize rounded-t transition-colors',
                                    outfitTab === tab
                                        ? 'text-white border-b-2 border-emerald-400'
                                        : 'text-slate-500 hover:text-slate-300'
                                )}>
                                {tab === 'outfit' ? t('studio.canvas.tabOutfit') : tab === 'accessory' ? t('studio.canvas.tabAccessory') : t('studio.canvas.tabProp')}
                            </button>
                        ))}
                    </div>
                    {(() => {
                        const filtered = avatarAssets.filter(a => a.type === outfitTab)
                        if (filtered.length === 0) return (
                            <div className="flex flex-col items-center gap-3 py-8">
                                <p className="text-slate-400 text-sm">{t('studio.canvas.noAssetsOfType').replace('{type}', outfitTab)}</p>
                                <Link href={`/dashboard/studio/${channelId}/avatars`}>
                                    <Button size="sm" className="gap-1.5 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold text-xs">
                                        <Plus className="h-3.5 w-3.5" /> {t('studio.canvas.addType').replace('{type}', outfitTab)}
                                    </Button>
                                </Link>
                            </div>
                        )
                        return (
                            <div className="grid grid-cols-3 gap-3">
                                {filtered.map(asset => {
                                    const img = (asset.images as Array<{ url: string }>)?.[0]?.url
                                    return (
                                        <button key={asset.id} onClick={() => selectOutfitForNode(asset)}
                                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-white/10 hover:border-emerald-400/40 hover:bg-emerald-400/5 transition-all">
                                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                                                {img
                                                    ? <img src={img} alt={asset.name} className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                                        {outfitTab === 'outfit' ? <Shirt className="h-5 w-5 text-slate-600" /> : <Gem className="h-5 w-5 text-slate-600" />}
                                                    </div>
                                                }
                                            </div>
                                            <p className="text-[11px] font-medium text-white text-center truncate w-full">{asset.name}</p>
                                        </button>
                                    )
                                })}
                            </div>
                        )
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    )
}
