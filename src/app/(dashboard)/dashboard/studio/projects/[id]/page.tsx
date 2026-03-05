'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
    BackgroundVariant,
    Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
    ChevronLeft, Save, Play, LayoutTemplate, Loader2,
    Image as ImageIcon, Plus, MoreHorizontal, ExternalLink,
    CheckCircle2, AlertCircle, Clock, User, Type, ShoppingBag
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { AvatarNode } from '@/components/studio/nodes/AvatarNode'
import { PromptNode } from '@/components/studio/nodes/PromptNode'
import { ProductNode } from '@/components/studio/nodes/ProductNode'
import { ImageGenNode } from '@/components/studio/nodes/ImageGenNode'

interface StudioAvatar {
    id: string; name: string; coverImage: string | null; prompt: string; style: string
}

interface StudioOutput {
    id: string; url: string; type: string; prompt: string | null; createdAt: string
    metadata: { model?: string; size?: string } | null
}

interface StudioProject {
    id: string; name: string; description: string | null; status: string
    workflow: { nodesJson: unknown[]; edgesJson: unknown[] } | null
    outputs: StudioOutput[]
    jobs: Array<{ id: string; status: string; createdAt: string; finishedAt: string | null }>
}

// ─── Default workflow template ────────────────────────────────────
const DEFAULT_NODES = [
    {
        id: 'avatar-1', type: 'avatarNode', position: { x: 80, y: 80 },
        data: { avatarId: null, avatarName: null, avatarCover: null, avatarPrompt: null },
    },
    {
        id: 'prompt-1', type: 'promptNode', position: { x: 80, y: 260 },
        data: { prompt: '' },
    },
    {
        id: 'imagegen-1', type: 'imageGenNode', position: { x: 420, y: 140 },
        data: { model: 'fal-ai/flux/schnell', imageSize: 'landscape_4_3', numImages: 1 },
    },
]

const DEFAULT_EDGES = [
    { id: 'e-avatar-img', source: 'avatar-1', target: 'imagegen-1', targetHandle: 'avatar', animated: true, style: { stroke: '#34d399' } },
    { id: 'e-prompt-img', source: 'prompt-1', target: 'imagegen-1', targetHandle: 'prompt', animated: true, style: { stroke: '#a78bfa' } },
]

// ─── Main Page ────────────────────────────────────────────────────
export default function ProjectPage() {
    const { id } = useParams<{ id: string }>()
    const [project, setProject] = useState<StudioProject | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [running, setRunning] = useState(false)
    const [rightTab, setRightTab] = useState<'outputs' | 'history'>('outputs')
    const [avatars, setAvatars] = useState<StudioAvatar[]>([])
    const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
    const [avatarPickerNodeId, setAvatarPickerNodeId] = useState<string | null>(null)

    const [nodes, setNodes, onNodesChange] = useNodesState(DEFAULT_NODES as never[])
    const [edges, setEdges, onEdgesChange] = useEdgesState(DEFAULT_EDGES as never[])
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ─── Node types (must be stable refs) ─────────────────────────
    const nodeTypes: NodeTypes = {
        avatarNode: (props: never) => <AvatarNode {...props} data={{
            ...((props as { data: Record<string, unknown> }).data),
            onSelect: () => {
                setAvatarPickerNodeId((props as { id: string }).id)
                setAvatarPickerOpen(true)
            }
        }} />,
        promptNode: (props: never) => <PromptNode {...props} data={{
            ...((props as { data: Record<string, unknown> }).data),
            onChange: (val: string) => updateNodeData((props as { id: string }).id, { prompt: val }),
        }} />,
        productNode: ProductNode,
        imageGenNode: (props: never) => <ImageGenNode {...props} data={{
            ...((props as { data: Record<string, unknown> }).data),
            running,
            onRun: handleRun,
            onChange: (key: string, val: unknown) => updateNodeData((props as { id: string }).id, { [key]: val }),
        }} />,
    }

    useEffect(() => {
        fetchProject()
        fetchAvatars()
        return () => { if (pollRef.current) clearTimeout(pollRef.current) }
    }, [id])

    async function fetchProject() {
        setLoading(true)
        try {
            const res = await fetch(`/api/studio/projects/${id}`)
            if (res.ok) {
                const data = await res.json()
                setProject(data.project)
                if (data.project.workflow) {
                    const wf = data.project.workflow
                    if ((wf.nodesJson as unknown[]).length > 0) setNodes(wf.nodesJson as never[])
                    if ((wf.edgesJson as unknown[]).length > 0) setEdges(wf.edgesJson as never[])
                }
            }
        } finally {
            setLoading(false)
        }
    }

    async function fetchAvatars() {
        const res = await fetch('/api/studio/avatars')
        if (res.ok) {
            const data = await res.json()
            setAvatars(data.avatars || [])
        }
    }

    function updateNodeData(nodeId: string, updates: Record<string, unknown>) {
        setNodes(nds => nds.map(n =>
            (n as { id: string }).id === nodeId ? { ...n, data: { ...(n as { data: Record<string, unknown> }).data, ...updates } } : n
        ) as never[])
    }

    function selectAvatarForNode(avatar: StudioAvatar) {
        if (!avatarPickerNodeId) return
        updateNodeData(avatarPickerNodeId, {
            avatarId: avatar.id,
            avatarName: avatar.name,
            avatarCover: avatar.coverImage,
            avatarPrompt: avatar.prompt,
        })
        setAvatarPickerOpen(false)
    }

    const onConnect = useCallback((connection: Connection) => {
        setEdges(eds => addEdge({
            ...connection,
            animated: true,
            style: { stroke: '#a78bfa' },
        }, eds as never[]) as never[])
    }, [setEdges])

    async function handleSave() {
        setSaving(true)
        try {
            await fetch(`/api/studio/projects/${id}/workflow`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodes, edges }),
            })
            toast.success('Workflow saved')
        } finally {
            setSaving(false)
        }
    }

    async function handleRun() {
        // Save first
        await fetch(`/api/studio/projects/${id}/workflow`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodes, edges }),
        })

        setRunning(true)
        try {
            const res = await fetch(`/api/studio/projects/${id}/run`, { method: 'POST' })
            if (res.ok) {
                toast.success('Generation started!')
                pollForCompletion()
            } else {
                const data = await res.json()
                toast.error(data.error || 'Failed to start generation')
                setRunning(false)
            }
        } catch {
            setRunning(false)
        }
    }

    function pollForCompletion() {
        let attempts = 0
        const check = async () => {
            attempts++
            if (attempts > 60) { setRunning(false); return }
            const res = await fetch(`/api/studio/projects/${id}`)
            if (res.ok) {
                const data = await res.json()
                const jobs = data.project.jobs || []
                const latest = jobs[0]
                if (latest?.status === 'done' || latest?.status === 'failed') {
                    setRunning(false)
                    setProject(data.project)
                    if (latest.status === 'done') toast.success('Image generated! Check outputs panel.')
                    else toast.error('Generation failed')
                } else {
                    pollRef.current = setTimeout(check, 4000)
                }
            }
        }
        check()
    }

    function addNode(type: string) {
        const id = `${type}-${Date.now()}`
        const newNode = {
            id,
            type,
            position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 80 },
            data: type === 'promptNode' ? { prompt: '' }
                : type === 'imageGenNode' ? { model: 'fal-ai/flux/schnell', imageSize: 'landscape_4_3', numImages: 1 }
                    : {},
        }
        setNodes(nds => [...nds, newNode as never])
    }

    const outputs = project?.outputs || []

    return (
        <div className="flex h-screen overflow-hidden bg-[#080d0b]">
            {/* ── Left toolbar ─────────────────────────────────────────── */}
            <aside className="w-14 border-r border-white/5 flex flex-col items-center py-4 gap-3 bg-[#080d0b] shrink-0">
                <Link href="/dashboard/studio">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="h-px w-8 bg-white/10" />
                {/* Add nodes */}
                {[
                    { type: 'avatarNode', icon: User, color: 'text-emerald-400 hover:bg-emerald-400/10', title: 'Add Avatar' },
                    { type: 'promptNode', icon: Type, color: 'text-violet-400 hover:bg-violet-400/10', title: 'Add Prompt' },
                    { type: 'productNode', icon: ShoppingBag, color: 'text-amber-400 hover:bg-amber-400/10', title: 'Add Product' },
                    { type: 'imageGenNode', icon: ImageIcon, color: 'text-pink-400 hover:bg-pink-400/10', title: 'Add Image Gen' },
                ].map(item => (
                    <button
                        key={item.type}
                        onClick={() => addNode(item.type)}
                        title={item.title}
                        className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-colors', item.color)}
                    >
                        <item.icon className="h-4 w-4" />
                    </button>
                ))}
            </aside>

            {/* ── Canvas ────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top bar */}
                <header className="h-12 border-b border-white/5 bg-[#080d0b]/90 backdrop-blur-md flex items-center px-4 gap-3 shrink-0">
                    {loading ? (
                        <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                    ) : (
                        <span className="text-sm font-bold text-white">{project?.name}</span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 text-slate-400 hover:text-white text-xs"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Save
                        </Button>
                        <Button
                            size="sm"
                            className="h-7 gap-1.5 bg-pink-400 text-[#080d0b] hover:bg-pink-300 font-bold text-xs shadow-[0_0_12px_rgba(244,114,182,0.3)]"
                            onClick={handleRun}
                            disabled={running}
                        >
                            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                            Run Workflow
                        </Button>
                    </div>
                </header>

                {/* Flow canvas */}
                <div className="flex-1 relative">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                        </div>
                    ) : (
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            nodeTypes={nodeTypes}
                            fitView
                            deleteKeyCode="Delete"
                            className="bg-[#080d0b]"
                            style={{ background: '#080d0b' }}
                        >
                            <Background
                                variant={BackgroundVariant.Dots}
                                gap={24}
                                size={1}
                                color="rgba(0,255,149,0.06)"
                            />
                            <Controls
                                className="!bg-[#0f1a14] !border-white/10 [&>button]:!bg-[#0f1a14] [&>button]:!text-slate-400 [&>button:hover]:!text-white [&>button:hover]:!bg-white/10"
                            />
                            <MiniMap
                                className="!bg-[#0a120d] !border-white/10"
                                nodeColor={(n) => {
                                    const t = (n as { type?: string }).type
                                    if (t === 'avatarNode') return '#34d399'
                                    if (t === 'promptNode') return '#a78bfa'
                                    if (t === 'productNode') return '#fbbf24'
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

            {/* ── Right panel: Outputs + History ───────────────────────── */}
            <aside className="w-72 border-l border-white/5 bg-[#0a120d] flex flex-col shrink-0">
                <div className="flex border-b border-white/5 shrink-0">
                    {(['outputs', 'history'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setRightTab(tab)}
                            className={cn(
                                'flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors',
                                rightTab === tab ? 'text-white border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'
                            )}
                        >
                            {tab === 'outputs' ? `Outputs (${outputs.length})` : 'History'}
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
                                <p className="text-xs text-slate-500 text-center">No outputs yet.<br />Run the workflow to generate images.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {outputs.map(out => (
                                    <div key={out.id} className="group relative aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-pink-400/40 transition-colors">
                                        <img src={out.url} alt="" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-1.5">
                                            <span className="text-[9px] text-slate-400">{out.metadata?.model?.split('/').pop()}</span>
                                            <a href={out.url} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-3.5 w-3.5 text-white" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
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
                                                    : <Clock className="h-3.5 w-3.5 text-slate-500" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-white capitalize">{job.status}</p>
                                        <p className="text-[9px] text-slate-500">{new Date(job.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                            {(project?.jobs || []).length === 0 && (
                                <p className="text-xs text-slate-600 text-center py-8">No runs yet</p>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* ── Avatar Picker Dialog ─────────────────────────────────── */}
            <Dialog open={avatarPickerOpen} onOpenChange={setAvatarPickerOpen}>
                <DialogContent className="sm:max-w-lg bg-[#0f1a14] border-emerald-400/20">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <User className="h-5 w-5 text-emerald-400" />
                            Select Avatar
                        </DialogTitle>
                    </DialogHeader>
                    {avatars.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <p className="text-slate-400 text-sm">No avatars yet.</p>
                            <Link href="/dashboard/studio/avatars">
                                <Button size="sm" className="gap-1.5 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold">
                                    <Plus className="h-3.5 w-3.5" /> Create Avatar
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3 pt-1">
                            {avatars.map(av => (
                                <button
                                    key={av.id}
                                    onClick={() => selectAvatarForNode(av)}
                                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-white/10 hover:border-emerald-400/40 hover:bg-emerald-400/5 transition-all group"
                                >
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
        </div>
    )
}
