'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    Clapperboard, Plus, User, Image as ImageIcon, Video,
    FolderOpen, Clock, CheckCircle2, AlertCircle, Loader2,
    Sparkles, ArrowRight, ChevronRight, Play, MoreHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/lib/i18n'
import { useWorkspace } from '@/lib/workspace-context'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface StudioAvatar {
    id: string
    name: string
    coverImage: string | null
    status: string
    style: string
    createdAt: string
}

interface StudioProject {
    id: string
    name: string
    description: string | null
    coverImage: string | null
    status: string
    lastRunAt: string | null
    createdAt: string
    updatedAt: string
    _count: { outputs: number; jobs: number }
    jobs: Array<{ status: string; createdAt: string }>
}

export default function StudioPage() {
    const t = useTranslation()
    const { activeChannelId } = useWorkspace()
    const [projects, setProjects] = useState<StudioProject[]>([])
    const [avatars, setAvatars] = useState<StudioAvatar[]>([])
    const [loadingProjects, setLoadingProjects] = useState(true)
    const [loadingAvatars, setLoadingAvatars] = useState(true)
    const [showNewProject, setShowNewProject] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')
    const [newProjectDesc, setNewProjectDesc] = useState('')
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        fetchProjects()
        fetchAvatars()
    }, [activeChannelId])

    async function fetchProjects() {
        setLoadingProjects(true)
        try {
            const res = await fetch('/api/studio/projects')
            if (res.ok) {
                const data = await res.json()
                setProjects(data.projects || [])
            }
        } finally {
            setLoadingProjects(false)
        }
    }

    async function fetchAvatars() {
        setLoadingAvatars(true)
        try {
            const url = activeChannelId
                ? `/api/studio/avatars?channelId=${activeChannelId}`
                : '/api/studio/avatars'
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setAvatars(data.avatars || [])
            }
        } finally {
            setLoadingAvatars(false)
        }
    }

    async function createProject() {
        if (!newProjectName.trim()) return
        setCreating(true)
        try {
            const res = await fetch('/api/studio/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProjectName.trim(), description: newProjectDesc.trim() || undefined }),
            })
            if (res.ok) {
                const data = await res.json()
                setProjects(prev => [data.project, ...prev])
                setShowNewProject(false)
                setNewProjectName('')
                setNewProjectDesc('')
                toast.success('Project created successfully!')
            }
        } finally {
            setCreating(false)
        }
    }

    const totalOutputs = projects.reduce((s, p) => s + p._count.outputs, 0)
    const activeProjects = projects.filter(p => p.status === 'active').length

    function getStatusBadge(status: string) {
        if (status === 'done') return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400"><CheckCircle2 className="h-3 w-3" />Done</span>
        if (status === 'running' || status === 'pending') return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-400"><Loader2 className="h-3 w-3 animate-spin" />Running</span>
        if (status === 'failed') return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400"><AlertCircle className="h-3 w-3" />Failed</span>
        return <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">—</span>
    }

    return (
        <div className="flex h-screen overflow-hidden bg-[#080d0b]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0, 255, 149, 0.04) 1px, transparent 0)', backgroundSize: '32px 32px' }}>
            {/* Left sidebar: navigation */}
            <aside className="w-56 border-r border-emerald-500/10 bg-[#080d0b] flex flex-col p-4 gap-1 shrink-0">
                <div className="flex items-center gap-2 px-2 py-3 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-400/20 flex items-center justify-center">
                        <Clapperboard className="h-4 w-4 text-emerald-400" />
                    </div>
                    <span className="font-bold text-white tracking-tight">Studio</span>
                </div>

                {[
                    { label: 'All Projects', icon: FolderOpen, href: '/dashboard/studio', active: true },
                    { label: 'Avatars', icon: User, href: '/dashboard/studio/avatars', active: false },
                    { label: 'History', icon: Clock, href: '/dashboard/studio/history', active: false },
                ].map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            item.active
                                ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                        )}
                    >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                    </Link>
                ))}

                <div className="mt-auto pt-4 border-t border-white/5">
                    <Link
                        href="/dashboard/api-keys"
                        className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        Configure API Keys
                    </Link>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 flex flex-col overflow-y-auto">
                {/* Header */}
                <header className="sticky top-0 z-10 px-8 py-5 border-b border-white/5 bg-[#080d0b]/90 backdrop-blur-md flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Studio</h1>
                        <p className="text-slate-400 text-sm mt-0.5">AI image & video generation workspace</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/studio/avatars">
                            <Button variant="outline" size="sm" className="gap-2 border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/10">
                                <User className="h-4 w-4" />
                                Create Avatar
                            </Button>
                        </Link>
                        <Button
                            size="sm"
                            className="gap-2 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold shadow-[0_0_20px_rgba(0,255,149,0.2)]"
                            onClick={() => setShowNewProject(true)}
                        >
                            <Plus className="h-4 w-4" />
                            New Project
                        </Button>
                    </div>
                </header>

                <div className="px-8 py-6 space-y-8">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'Total Outputs', value: totalOutputs, icon: ImageIcon, color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/20' },
                            { label: 'Active Projects', value: activeProjects, icon: FolderOpen, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
                            { label: 'Avatars', value: avatars.length, icon: User, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
                        ].map((stat) => (
                            <div key={stat.label} className={cn('p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-400/20 transition-colors group')}>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-slate-400 text-sm">{stat.label}</p>
                                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', stat.bg, `border ${stat.border}`)}>
                                        <stat.icon className={cn('h-4 w-4', stat.color)} />
                                    </div>
                                </div>
                                <p className="text-3xl font-black text-white">{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Avatars strip */}
                    {(avatars.length > 0 || !loadingAvatars) && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-bold text-white">Your Avatars</h2>
                                <Link href="/dashboard/studio/avatars" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                                    View all <ChevronRight className="h-3 w-3" />
                                </Link>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-1">
                                {/* Add Avatar card */}
                                <Link href="/dashboard/studio/avatars">
                                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-1 hover:border-emerald-400/40 hover:bg-emerald-400/5 transition-colors cursor-pointer shrink-0">
                                        <Plus className="h-5 w-5 text-slate-500" />
                                        <span className="text-[10px] text-slate-500">New</span>
                                    </div>
                                </Link>
                                {avatars.slice(0, 8).map((av) => (
                                    <div key={av.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 shrink-0 group">
                                        {av.coverImage ? (
                                            <img src={av.coverImage} alt={av.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                                {av.status === 'generating'
                                                    ? <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
                                                    : <User className="h-5 w-5 text-slate-600" />
                                                }
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-[9px] text-white font-medium truncate">{av.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Projects table */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold text-white">Projects</h2>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                            <div className="px-6 py-3 border-b border-white/5 grid grid-cols-[2fr_1fr_1fr_100px_80px] gap-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                                <span>Project</span>
                                <span>Status</span>
                                <span>Outputs</span>
                                <span>Last Run</span>
                                <span></span>
                            </div>

                            {loadingProjects ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                                </div>
                            ) : projects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                                        <Clapperboard className="h-7 w-7 text-emerald-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-white font-bold mb-1">No projects yet</p>
                                        <p className="text-slate-400 text-sm">Create your first project to start generating AI content</p>
                                    </div>
                                    <Button
                                        onClick={() => setShowNewProject(true)}
                                        className="gap-2 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold"
                                    >
                                        <Plus className="h-4 w-4" />
                                        New Project
                                    </Button>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {projects.map((project) => {
                                        const lastJob = project.jobs[0]
                                        return (
                                            <div key={project.id} className="px-6 py-4 grid grid-cols-[2fr_1fr_1fr_100px_80px] gap-4 items-center hover:bg-white/[0.02] transition-colors group">
                                                {/* Name */}
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                                                        {project.coverImage
                                                            ? <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />
                                                            : <Clapperboard className="h-4 w-4 text-emerald-400" />
                                                        }
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-white truncate">{project.name}</p>
                                                        {project.description && (
                                                            <p className="text-xs text-slate-500 truncate">{project.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Status */}
                                                <div>
                                                    {lastJob ? getStatusBadge(lastJob.status) : (
                                                        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">No runs</span>
                                                    )}
                                                </div>
                                                {/* Outputs */}
                                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                                    <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />{project._count.outputs}</span>
                                                </div>
                                                {/* Last run */}
                                                <div className="text-xs text-slate-500">
                                                    {project.lastRunAt
                                                        ? new Date(project.lastRunAt).toLocaleDateString()
                                                        : '—'
                                                    }
                                                </div>
                                                {/* Action */}
                                                <div className="flex justify-end">
                                                    <Link href={`/dashboard/studio/projects/${project.id}`}>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-xs gap-1.5 border-emerald-400/20 text-emerald-400 hover:bg-emerald-400 hover:text-[#080d0b] transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Play className="h-3 w-3" />
                                                            Open
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* New Project Dialog */}
            <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
                <DialogContent className="sm:max-w-md bg-[#0f1a14] border-emerald-400/20">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Clapperboard className="h-5 w-5 text-emerald-400" />
                            New Project
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <Label className="text-slate-300 text-xs">Project Name *</Label>
                            <Input
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                placeholder="e.g. Summer Collection Ads"
                                className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-400/40"
                                onKeyDown={e => e.key === 'Enter' && createProject()}
                            />
                        </div>
                        <div>
                            <Label className="text-slate-300 text-xs">Description <span className="text-slate-600">(optional)</span></Label>
                            <Textarea
                                value={newProjectDesc}
                                onChange={e => setNewProjectDesc(e.target.value)}
                                placeholder="What this project is about..."
                                className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-400/40 resize-none"
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setShowNewProject(false)} className="text-slate-400">
                                Cancel
                            </Button>
                            <Button
                                onClick={createProject}
                                disabled={!newProjectName.trim() || creating}
                                className="gap-2 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold"
                            >
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Create Project
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
