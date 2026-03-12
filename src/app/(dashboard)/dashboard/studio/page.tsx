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
    poseImages: string[]   // AI generated angle images
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
        <>
            {/* Page header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">{t('studio.projects')}</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">{t('studio.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        size="sm"
                        className="gap-2 bg-emerald-500 hover:bg-emerald-400 font-bold"
                        onClick={() => setShowNewProject(true)}
                    >
                        <Plus className="h-4 w-4" />
                        New Project
                    </Button>
                </div>
            </div>

            <div className="px-6 py-6 space-y-6">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: t('studio.totalProjects'), value: projects.length, icon: FolderOpen, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                        { label: t('studio.totalOutputs'), value: totalOutputs, icon: ImageIcon, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
                        { label: t('studio.avatars'), value: avatars.length, icon: User, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                    ].map((stat) => (
                        <div key={stat.label} className="p-5 rounded-2xl bg-card border border-border hover:border-emerald-500/30 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-muted-foreground text-sm">{stat.label}</p>
                                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', stat.bg, `border ${stat.border}`)}>
                                    <stat.icon className={cn('h-4 w-4', stat.color)} />
                                </div>
                            </div>
                            <p className="text-3xl font-black">{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Projects grid */}
                {loadingProjects ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Clapperboard className="h-7 w-7 text-emerald-500" />
                        </div>
                        <div className="text-center">
                            <p className="font-bold mb-1">{t('studio.noProjects')}</p>
                            <p className="text-muted-foreground text-sm">{t('studio.noProjectsDesc')}</p>
                        </div>
                        <Button
                            onClick={() => setShowNewProject(true)}
                            className="gap-2 bg-emerald-500 hover:bg-emerald-400 font-bold"
                        >
                            <Plus className="h-4 w-4" />
                            New Project
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {projects.map((project) => (
                            <Link key={project.id} href={`/dashboard/studio/projects/${project.id}`}>
                                <div className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-emerald-500/40 hover:shadow-md transition-all">
                                    {/* Thumbnail */}
                                    <div className="aspect-video bg-muted flex items-center justify-center">
                                        {project.coverImage
                                            ? <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />
                                            : <Clapperboard className="h-8 w-8 text-emerald-500/40" />
                                        }
                                    </div>
                                    {/* Info */}
                                    <div className="p-4">
                                        <p className="font-bold text-sm truncate">{project.name}</p>
                                        {project.description && (
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">{project.description}</p>
                                        )}
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <ImageIcon className="h-3.5 w-3.5" />{project._count.outputs} outputs
                                            </span>
                                            <ChevronRight className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* New Project Dialog */}
            <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Clapperboard className="h-5 w-5 text-emerald-500" />
                            New Project
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <Label className="text-xs">Project Name *</Label>
                            <Input
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                placeholder="e.g. Summer Collection Ads"
                                className="mt-1.5"
                                onKeyDown={e => e.key === 'Enter' && createProject()}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
                            <Textarea
                                value={newProjectDesc}
                                onChange={e => setNewProjectDesc(e.target.value)}
                                placeholder="What this project is about..."
                                className="mt-1.5 resize-none"
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setShowNewProject(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={createProject}
                                disabled={!newProjectName.trim() || creating}
                                className="gap-2 bg-emerald-500 hover:bg-emerald-400 font-bold"
                            >
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Create Project
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
