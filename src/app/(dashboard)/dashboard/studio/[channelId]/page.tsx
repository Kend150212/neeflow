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
    const [projects, setProjects] = useState<StudioProject[]>([])
    const [avatars, setAvatars] = useState<StudioAvatar[]>([])
    const [loadingProjects, setLoadingProjects] = useState(true)
    const [activeNav, setActiveNav] = useState<'projects' | 'avatars'>('projects')

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
                toast.error('Failed to create project')
            }
        } finally { setCreating(false) }
    }

    async function archiveProject(projectId: string, e: React.MouseEvent) {
        e.preventDefault(); e.stopPropagation()
        await fetch(`/api/studio/channels/${channelId}/projects/${projectId}`, { method: 'DELETE' })
        setProjects(p => p.filter(pr => pr.id !== projectId))
        toast.success('Project archived')
    }

    const statusColor: Record<string, string> = {
        done: 'bg-emerald-500', running: 'bg-blue-500 animate-pulse', failed: 'bg-red-500', pending: 'bg-amber-500',
    }

    return (
        <div className="flex h-screen overflow-hidden bg-[#080d0b] text-white">
            {/* Left sidebar */}
            <aside className="w-52 border-r border-white/5 flex flex-col pt-6 shrink-0">
                <div className="px-5 mb-6 flex items-center gap-2">
                    <Clapperboard className="h-5 w-5 text-emerald-400" />
                    <span className="font-extrabold text-base tracking-tight">Studio</span>
                </div>
                <nav className="flex-1 px-3 space-y-1">
                    {[
                        { key: 'projects', label: 'Projects', icon: FolderOpen },
                        { key: 'avatars', label: 'Avatars', icon: User },
                    ].map(item => (
                        <button
                            key={item.key}
                            onClick={() => setActiveNav(item.key as 'projects' | 'avatars')}
                            className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                activeNav === item.key
                                    ? 'bg-emerald-400/10 text-emerald-400'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-3 border-t border-white/5">
                    <Link href={`/dashboard/studio/${channelId}/avatars`}>
                        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-slate-500 hover:text-white text-xs">
                            <User className="h-3.5 w-3.5" /> Manage Avatars
                        </Button>
                    </Link>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-[#080d0b]/90 backdrop-blur-sm border-b border-white/5 px-8 py-4 flex items-center justify-between z-10">
                    <div>
                        <h1 className="text-xl font-extrabold">{activeNav === 'projects' ? 'Projects' : 'Avatars'}</h1>
                        <p className="text-xs text-slate-500 mt-0.5">AI image & video generation canvas</p>
                    </div>
                    {activeNav === 'projects' && (
                        <Button
                            onClick={() => setNewOpen(true)}
                            className="gap-1.5 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold shadow-[0_0_16px_rgba(52,211,153,0.25)]"
                        >
                            <Plus className="h-4 w-4" /> New Project
                        </Button>
                    )}
                    {activeNav === 'avatars' && (
                        <Link href={`/dashboard/studio/${channelId}/avatars`}>
                            <Button className="gap-1.5 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold">
                                <Plus className="h-4 w-4" /> New Avatar
                            </Button>
                        </Link>
                    )}
                </div>

                <div className="p-8">
                    {activeNav === 'projects' && (
                        <>
                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                {[
                                    { label: 'Total Projects', value: projects.length, icon: FolderOpen, color: 'text-emerald-400 bg-emerald-400/10' },
                                    { label: 'Total Outputs', value: projects.reduce((s, p) => s + p._count.outputs, 0), icon: ImageIcon, color: 'text-pink-400 bg-pink-400/10' },
                                    { label: 'Avatars', value: avatars.length, icon: User, color: 'text-violet-400 bg-violet-400/10' },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-[#0a120d] border border-white/5 rounded-xl p-5 flex items-center gap-4">
                                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', stat.color)}>
                                            <stat.icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black">{stat.value}</p>
                                            <p className="text-xs text-slate-500">{stat.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Avatars strip */}
                            {avatars.length > 0 && (
                                <div className="mb-8">
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Avatars</p>
                                    <div className="flex gap-3 overflow-x-auto pb-2">
                                        {avatars.map(av => (
                                            <div key={av.id} className="shrink-0 flex flex-col items-center gap-1.5">
                                                <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/10">
                                                    {av.coverImage
                                                        ? <img src={av.coverImage} alt={av.name} className="w-full h-full object-cover" />
                                                        : <div className="w-full h-full bg-white/5 flex items-center justify-center"><User className="h-5 w-5 text-slate-600" /></div>
                                                    }
                                                    <span className={cn('absolute bottom-1 right-1 w-2 h-2 rounded-full', av.status === 'done' ? 'bg-emerald-400' : av.status === 'generating' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600')} />
                                                </div>
                                                <p className="text-[10px] text-slate-400 max-w-[56px] truncate text-center">{av.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Projects grid */}
                            {loadingProjects ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                                </div>
                            ) : projects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                                        <Clapperboard className="h-7 w-7 text-emerald-400" />
                                    </div>
                                    <p className="text-slate-400 text-sm">No projects yet. Create one to start generating.</p>
                                    <Button onClick={() => setNewOpen(true)} className="gap-1.5 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold">
                                        <Plus className="h-4 w-4" /> New Project
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {projects.map(project => (
                                        <Link
                                            key={project.id}
                                            href={`/dashboard/studio/${channelId}/projects/${project.id}`}
                                            className="group relative bg-[#0a120d] border border-white/5 rounded-2xl overflow-hidden hover:border-emerald-400/30 transition-all hover:shadow-[0_0_20px_rgba(52,211,153,0.08)]"
                                        >
                                            {/* Cover */}
                                            <div className="aspect-video bg-[#080d0b] relative overflow-hidden">
                                                {project.coverImage
                                                    ? <img src={project.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    : <div className="w-full h-full flex items-center justify-center">
                                                        <ImageIcon className="h-8 w-8 text-slate-700" />
                                                    </div>
                                                }
                                                {/* Badges */}
                                                <div className="absolute top-2 right-2 flex gap-1.5">
                                                    {project.jobs[0] && (
                                                        <span className={cn('w-2 h-2 rounded-full', statusColor[project.jobs[0].status] || 'bg-slate-600')} title={project.jobs[0].status} />
                                                    )}
                                                </div>
                                            </div>
                                            {/* Content */}
                                            <div className="p-4">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-white truncate">{project.name}</p>
                                                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <ImageIcon className="h-3 w-3" /> {project._count.outputs} outputs
                                                            {project.lastRunAt && <><Clock className="h-3 w-3 ml-1.5" />{new Date(project.lastRunAt).toLocaleDateString()}</>}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={(e) => archiveProject(project.id, e)}
                                                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-600 hover:text-red-400 transition-all"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {activeNav === 'avatars' && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Link href={`/dashboard/studio/${channelId}/avatars`}>
                                <Button className="gap-2 bg-emerald-400 text-[#080d0b] font-bold">
                                    <User className="h-4 w-4" /> Go to Avatars Manager
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* New Project Dialog */}
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
                <DialogContent className="sm:max-w-md bg-[#0f1a14] border-emerald-400/20">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Clapperboard className="h-5 w-5 text-emerald-400" /> New Project
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Project Name *</label>
                            <Input
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="e.g. Summer Campaign 2025"
                                className="bg-[#080d0b] border-white/10 text-white focus:border-emerald-400/50"
                                onKeyDown={e => e.key === 'Enter' && createProject()}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Description</label>
                            <Textarea
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                                placeholder="What is this project about?"
                                rows={2}
                                className="bg-[#080d0b] border-white/10 text-white focus:border-emerald-400/50 resize-none"
                            />
                        </div>
                        <Button
                            onClick={createProject}
                            disabled={creating || !newName.trim()}
                            className="w-full bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold"
                        >
                            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Create Project
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
