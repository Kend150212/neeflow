'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    Plus, Loader2, Clapperboard, Image as ImageIcon,
    FolderOpen, Clock, User, ChevronRight, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface StudioProject {
    id: string; name: string; description: string | null
    coverImage: string | null; status: string; lastRunAt: string | null; updatedAt: string
    _count: { outputs: number; jobs: number }
    jobs: Array<{ status: string; createdAt: string }>
}

interface StudioAvatar {
    id: string; name: string; coverImage: string | null; status: string; style: string
}

export default function StudioChannelPage() {
    const { channelId } = useParams<{ channelId: string }>()
    const router = useRouter()
    const t = useTranslation()
    const [projects, setProjects] = useState<StudioProject[]>([])
    const [avatars, setAvatars] = useState<StudioAvatar[]>([])
    const [loadingProjects, setLoadingProjects] = useState(true)

    // New project dialog
    const [newOpen, setNewOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        fetchProjects()
        fetchAvatars()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId])

    async function fetchProjects() {
        setLoadingProjects(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/projects`)
            if (res.ok) setProjects((await res.json()).projects || [])
        } finally { setLoadingProjects(false) }
    }

    async function fetchAvatars() {
        const res = await fetch('/api/studio/avatars')
        if (res.ok) setAvatars((await res.json()).avatars || [])
    }

    async function createProject() {
        if (!newName.trim()) return
        setCreating(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, description: newDesc || undefined }),
            })
            if (res.ok) {
                const { project } = await res.json()
                setNewOpen(false); setNewName(''); setNewDesc('')
                router.push(`/dashboard/studio/${channelId}/projects/${project.id}`)
            } else {
                toast.error(t('studio.failedCreateProject'))
            }
        } finally { setCreating(false) }
    }

    async function archiveProject(projectId: string, e: React.MouseEvent) {
        e.preventDefault(); e.stopPropagation()
        await fetch(`/api/studio/channels/${channelId}/projects/${projectId}`, { method: 'DELETE' })
        setProjects(p => p.filter(pr => pr.id !== projectId))
        toast.success(t('studio.projectArchived'))
    }

    const totalOutputs = projects.reduce((s, p) => s + p._count.outputs, 0)

    return (
        <>
            {/* Page header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">{t('studio.projects')}</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">{t('studio.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href={`/dashboard/studio/${channelId}/avatars`}>
                        <Button variant="outline" size="sm" className="gap-2">
                            <User className="h-4 w-4" /> Avatars
                        </Button>
                    </Link>
                    <Button
                        size="sm"
                        className="gap-2 bg-emerald-500 hover:bg-emerald-400 font-bold"
                        onClick={() => setNewOpen(true)}
                    >
                        <Plus className="h-4 w-4" /> New Project
                    </Button>
                </div>
            </div>

            <div className="px-6 py-6 space-y-6">
                {/* Stats */}
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
                        <Button onClick={() => setNewOpen(true)} className="gap-2 bg-emerald-500 hover:bg-emerald-400 font-bold">
                            <Plus className="h-4 w-4" /> New Project
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {projects.map(project => (
                            <Link key={project.id} href={`/dashboard/studio/${channelId}/projects/${project.id}`}>
                                <div className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-emerald-500/40 hover:shadow-md transition-all">
                                    {/* Thumbnail */}
                                    <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
                                        {project.coverImage
                                            ? <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            : <Clapperboard className="h-8 w-8 text-emerald-500/40" />
                                        }
                                        {project.jobs[0] && (
                                            <span className={cn(
                                                'absolute top-2 right-2 w-2 h-2 rounded-full',
                                                project.jobs[0].status === 'done' ? 'bg-emerald-500' :
                                                    project.jobs[0].status === 'running' ? 'bg-blue-500 animate-pulse' :
                                                        project.jobs[0].status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                                            )} />
                                        )}
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
                                                {project.lastRunAt && <><Clock className="h-3 w-3 ml-1" />{new Date(project.lastRunAt).toLocaleDateString()}</>}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => archiveProject(project.id, e)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-500 transition-all"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                                <ChevronRight className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* New Project Dialog */}
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
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
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder={t('studio.projectNamePlaceholder')}
                                className="mt-1.5"
                                onKeyDown={e => e.key === 'Enter' && createProject()}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
                            <Textarea
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                                placeholder={t('studio.descriptionPlaceholder')}
                                rows={2}
                                className="mt-1.5 resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setNewOpen(false)}>{t('studio.avatar.cancel')}</Button>
                            <Button
                                onClick={createProject}
                                disabled={creating || !newName.trim()}
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
