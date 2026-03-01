'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useWorkspace } from '@/lib/workspace-context'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Image as ImageIcon,
    FolderPlus,
    Folder,
    FolderOpen,
    Trash2,
    Pencil,
    Search,
    Upload,
    ChevronRight,
    Home,
    MoreVertical,
    Play,
    Loader2,
    LayoutGrid,
    List,
    ArrowUpDown,
    CheckSquare,
    Square,
    X,
    FolderInput,
    FileVideo,
    HardDrive,
    File,
    Maximize2,
    ChevronLeft,
} from 'lucide-react'


/* ─── Types ─── */
interface MediaItem {
    id: string
    channelId: string
    folderId: string | null
    url: string
    thumbnailUrl: string | null
    storageFileId: string | null
    type: string
    source: string
    originalName: string | null
    fileSize: number | null
    mimeType: string | null
    tags: string[]
    createdAt: string
}

interface MediaFolder {
    id: string
    channelId: string
    parentId: string | null
    name: string
    _count: { media: number; children: number }
}

interface Channel {
    id: string
    name: string
    displayName: string
}

/* ─── Helpers ─── */
function formatBytes(bytes: number | null) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

/* ═══════════════════════════════════════════════ */
export default function MediaLibraryPage() {
    const t = useTranslation()
    const { data: session } = useSession()

    // Channel selection — driven by workspace context
    const { activeChannelId, channels: wsChannels } = useWorkspace()
    const channels = wsChannels  // reuse workspace channels
    const [selectedChannelId, setSelectedChannelId] = useState<string>('')

    // Sync selectedChannelId whenever workspace or channels list changes
    useEffect(() => {
        if (activeChannelId) {
            setSelectedChannelId(activeChannelId)
            setCurrentFolderId(null)  // reset to root when workspace changes
            setBreadcrumbs([{ id: null, name: t('media.allFiles') }])
        } else if (channels.length > 0 && !selectedChannelId) {
            setSelectedChannelId(channels[0].id)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChannelId, channels])

    // Folders
    const [folders, setFolders] = useState<MediaFolder[]>([])
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
        { id: null, name: 'All Files' },
    ])

    // Media
    const [media, setMedia] = useState<MediaItem[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [lastClickedId, setLastClickedId] = useState<string | null>(null)

    // UI State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('newest')
    const [typeFilter, setTypeFilter] = useState<string>('')

    // Dialogs
    const [showCreateFolder, setShowCreateFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [renamingItem, setRenamingItem] = useState<{ id: string; type: 'folder' | 'media'; name: string } | null>(null)
    const [showMoveDialog, setShowMoveDialog] = useState(false)
    const [moveTargetFolder, setMoveTargetFolder] = useState<string | null>(null)
    const [allFolders, setAllFolders] = useState<MediaFolder[]>([])

    // Upload
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const dragCounter = useRef(0)

    // Lightbox
    const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null)

    // Storage usage
    const [storageUsage, setStorageUsage] = useState<{
        usedMB: number; limitMB: number; percentUsed: number; unlimited: boolean
    } | null>(null)

    const fetchStorageUsage = useCallback(async () => {
        try {
            const res = await fetch('/api/user/storage-usage')
            if (res.ok) setStorageUsage(await res.json())
        } catch { /* ignore */ }
    }, [])

    useEffect(() => { fetchStorageUsage() }, [fetchStorageUsage])

    /* ─── channels come from workspace context — no local fetch needed ─── */

    /* ─── Fetch folders ─── */
    const fetchFolders = useCallback(async () => {
        if (!selectedChannelId) return
        const params = new URLSearchParams({ channelId: selectedChannelId })
        if (currentFolderId) params.set('parentId', currentFolderId)
        const res = await fetch(`/api/admin/media/folders?${params}`)
        const d = await res.json()
        setFolders(d.folders || [])
    }, [selectedChannelId, currentFolderId])

    /* ─── Fetch media ─── */
    const fetchMedia = useCallback(async () => {
        if (!selectedChannelId) return
        setLoading(true)
        const params = new URLSearchParams({
            channelId: selectedChannelId,
            page: String(page),
            limit: '50',
            sort: sortBy,
        })
        if (currentFolderId) {
            params.set('folderId', currentFolderId)
        } else {
            params.set('folderId', 'root')
        }
        if (searchQuery) params.set('search', searchQuery)
        if (typeFilter) params.set('type', typeFilter)

        const res = await fetch(`/api/admin/media?${params}`)
        const d = await res.json()
        setMedia(d.media || [])
        setTotal(d.pagination?.total || 0)
        setLoading(false)
    }, [selectedChannelId, currentFolderId, page, sortBy, searchQuery, typeFilter])

    useEffect(() => {
        fetchFolders()
        fetchMedia()
        setSelectedIds(new Set())
    }, [fetchFolders, fetchMedia])

    /* ─── Navigate folder ─── */
    const navigateToFolder = (folderId: string | null, folderName?: string) => {
        if (folderId === null) {
            setBreadcrumbs([{ id: null, name: t('media.allFiles') }])
        } else {
            setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName || t('media.folders') }])
        }
        setCurrentFolderId(folderId)
        setPage(1)
        setSelectedIds(new Set())
    }

    const navigateToBreadcrumb = (index: number) => {
        const bc = breadcrumbs[index]
        setBreadcrumbs((prev) => prev.slice(0, index + 1))
        setCurrentFolderId(bc.id)
        setPage(1)
        setSelectedIds(new Set())
    }

    /* ─── Selection ─── */
    const allMediaIds = media.map((m) => m.id)
    const allSelected = allMediaIds.length > 0 && allMediaIds.every((id) => selectedIds.has(id))
    const someSelected = selectedIds.size > 0

    const toggleSelect = (id: string, shiftKey?: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)

            if (shiftKey && lastClickedId) {
                // Shift+click: select range
                const allIds = media.map((m) => m.id)
                const start = allIds.indexOf(lastClickedId)
                const end = allIds.indexOf(id)
                const range = allIds.slice(Math.min(start, end), Math.max(start, end) + 1)
                range.forEach((rid) => next.add(rid))
            } else {
                if (next.has(id)) next.delete(id)
                else next.add(id)
            }

            return next
        })
        setLastClickedId(id)
    }

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(allMediaIds))
        }
    }

    /* ─── Create Folder ─── */
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return
        try {
            const res = await fetch('/api/admin/media/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: selectedChannelId,
                    name: newFolderName.trim(),
                    parentId: currentFolderId,
                }),
            })
            if (!res.ok) {
                const e = await res.json()
                throw new Error(e.error || 'Failed')
            }
            toast.success(t('media.folderCreated'))
            setShowCreateFolder(false)
            setNewFolderName('')
            fetchFolders()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to create folder')
        }
    }

    /* ─── Rename ─── */
    const handleRename = async () => {
        if (!renamingItem || !renamingItem.name.trim()) return
        try {
            const url =
                renamingItem.type === 'folder'
                    ? `/api/admin/media/folders/${renamingItem.id}`
                    : `/api/admin/media/${renamingItem.id}`
            const body =
                renamingItem.type === 'folder'
                    ? { name: renamingItem.name.trim() }
                    : { originalName: renamingItem.name.trim() }
            const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error()
            toast.success(t('media.renamedSuccessfully'))
            setRenamingItem(null)
            fetchFolders()
            fetchMedia()
        } catch {
            toast.error(t('media.renameFailed'))
        }
    }

    /* ─── Delete folder ─── */
    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm(t('media.deleteFolderConfirm'))) return
        try {
            const res = await fetch(`/api/admin/media/folders/${folderId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            toast.success(t('media.folderDeleted'))
            fetchFolders()
            fetchMedia()
        } catch {
            toast.error(t('media.deleteFailed'))
        }
    }

    /* ─── Bulk delete ─── */
    const handleBulkDelete = async () => {
        if (!confirm(t('media.deleteConfirm').replace('{count}', String(selectedIds.size)))) return
        try {
            const res = await fetch('/api/admin/media/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', ids: Array.from(selectedIds) }),
            })
            if (!res.ok) throw new Error()
            toast.success(`${t('media.deleted').replace('{count}', String(selectedIds.size))}`)
            setSelectedIds(new Set())
            fetchMedia()
            fetchStorageUsage()
        } catch {
            toast.error('Failed to delete')
        }
    }

    /* ─── Single delete ─── */
    const handleDeleteMedia = async (id: string, name: string) => {
        if (!confirm(t('media.deleteConfirmSingle').replace('{name}', name))) return
        try {
            const res = await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            toast.success(t('media.deletedSingle'))
            setSelectedIds((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
            fetchMedia()
            fetchStorageUsage()
        } catch {
            toast.error('Failed to delete')
        }
    }

    /* ─── Bulk move ─── */
    const handleBulkMove = async () => {
        try {
            const res = await fetch('/api/admin/media/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'move',
                    ids: Array.from(selectedIds),
                    folderId: moveTargetFolder,
                }),
            })
            if (!res.ok) throw new Error()
            toast.success(t('media.moved').replace('{count}', String(selectedIds.size)))
            setShowMoveDialog(false)
            setSelectedIds(new Set())
            fetchMedia()
        } catch {
            toast.error(t('media.moveFailed'))
        }
    }

    const openMoveDialog = async () => {
        // Fetch all folders for this channel
        const res = await fetch(`/api/admin/media/folders?channelId=${selectedChannelId}`)
        const d = await res.json()
        setAllFolders(d.folders || [])
        setMoveTargetFolder(null)
        setShowMoveDialog(true)
    }

    /* ─── Upload ─── */
    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || !selectedChannelId) return
        setUploading(true)
        let successCount = 0
        let blockedByGdrive = false

        for (const file of Array.from(files)) {
            if (blockedByGdrive) break
            try {
                const formData = new FormData()
                formData.append('file', file)
                formData.append('channelId', selectedChannelId)
                if (currentFolderId) formData.append('folderId', currentFolderId)

                const res = await fetch('/api/admin/media', {
                    method: 'POST',
                    body: formData,
                })

                if (res.ok) {
                    successCount++
                } else {
                    const data = await res.json().catch(() => ({}))
                    if (res.status === 403 && data.code === 'GDRIVE_NOT_CONNECTED') {
                        blockedByGdrive = true
                        toast.error('Chưa kết nối Google Drive', {
                            description: 'Bạn cần kết nối Google Drive trước khi upload. Vào Cài đặt → API Keys để kết nối.',
                            action: { label: 'Kết nối ngay', onClick: () => (window.location.href = '/dashboard/api-keys') },
                            duration: 10000,
                        })
                    } else if (res.status === 429) {
                        blockedByGdrive = true
                        toast.error('Hết dung lượng lưu trữ', {
                            description: data.error || 'Dung lượng đã đầy. Nâng cấp plan để tăng dung lượng.',
                            duration: 8000,
                        })
                    } else {
                        toast.error(`Upload thất bại: ${file.name}`, { description: data.error || 'Lỗi không xác định' })
                    }
                }
            } catch (err) {
                console.error('Upload error:', err)
                toast.error(`Upload lỗi: ${file.name}`)
            }
        }

        setUploading(false)
        if (successCount > 0) {
            toast.success(t('media.uploaded').replace('{count}', String(successCount)))
            fetchMedia()
        }
    }

    /* ─── Full-page Drag & Drop ─── */
    // Use a counter instead of boolean to handle nested element enter/leave correctly
    useEffect(() => {
        const onDragEnter = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes('Files')) return
            e.preventDefault()
            dragCounter.current++
            if (dragCounter.current === 1) setIsDraggingOver(true)
        }
        const onDragOver = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes('Files')) return
            e.preventDefault()
        }
        const onDragLeave = (e: DragEvent) => {
            dragCounter.current--
            if (dragCounter.current === 0) setIsDraggingOver(false)
        }
        const onDrop = (e: DragEvent) => {
            e.preventDefault()
            dragCounter.current = 0
            setIsDraggingOver(false)
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                handleUpload(e.dataTransfer.files)
            }
        }

        document.addEventListener('dragenter', onDragEnter)
        document.addEventListener('dragover', onDragOver)
        document.addEventListener('dragleave', onDragLeave)
        document.addEventListener('drop', onDrop)
        return () => {
            document.removeEventListener('dragenter', onDragEnter)
            document.removeEventListener('dragover', onDragOver)
            document.removeEventListener('dragleave', onDragLeave)
            document.removeEventListener('drop', onDrop)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedChannelId, currentFolderId])

    // Keep the old zone-specific handlers for the explicit drop zone in the grid
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        handleUpload(e.dataTransfer.files)
    }

    const totalPages = Math.ceil(total / 50)
    const isVideo = (m: MediaItem) => m.type === 'video'

    /* ═══════════════════════════════════════════════ */
    return (
        <div className="flex flex-col h-full relative">
            {/* ─── Full-page drag overlay ─────────────────────────────────── */}
            {isDraggingOver && (
                <div
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
                    style={{
                        background: 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(4px)',
                        border: '3px dashed rgba(99,102,241,0.8)',
                        borderRadius: '12px',
                        pointerEvents: 'none',
                    }}
                >
                    <Upload className="h-16 w-16 text-indigo-400 animate-bounce" />
                    <p className="text-white text-2xl font-semibold">Thả file vào đây</p>
                    <p className="text-white/60 text-sm">
                        {selectedChannelId ? 'File sẽ được upload vào kênh hiện tại' : 'Chọn một channel trước'}
                    </p>
                </div>
            )}


            {/* ─── Header ─── */}
            <div className="border-b bg-card px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <h1 className="text-xl font-bold">{t('media.title')}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={selectedChannelId} onValueChange={(v) => {
                            setSelectedChannelId(v)
                            setCurrentFolderId(null)
                            setBreadcrumbs([{ id: null, name: 'All Files' }])
                            setPage(1)
                        }}>
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                                <SelectValue placeholder={t('media.selectChannel')} />
                            </SelectTrigger>
                            <SelectContent>
                                {channels.map((ch) => (
                                    <SelectItem key={ch.id} value={ch.id}>
                                        {ch.displayName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Storage usage bar */}
                {storageUsage && !storageUsage.unlimited && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <HardDrive className="h-3.5 w-3.5 shrink-0" />
                        <div className="w-[120px] h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${Math.min(100, storageUsage.percentUsed)}%`,
                                    backgroundColor: storageUsage.percentUsed > 90 ? '#ef4444'
                                        : storageUsage.percentUsed > 70 ? '#f59e0b' : '#22c55e',
                                }}
                            />
                        </div>
                        <span>
                            {storageUsage.usedMB >= 1024
                                ? `${(storageUsage.usedMB / 1024).toFixed(1)} GB`
                                : `${storageUsage.usedMB} MB`}
                            {' / '}
                            {storageUsage.limitMB >= 1024
                                ? `${(storageUsage.limitMB / 1024).toFixed(0)} GB`
                                : `${storageUsage.limitMB} MB`}
                        </span>
                    </div>
                )}

                {/* Toolbar */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder={t('media.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setPage(1)
                            }}
                            className="h-8 pl-8 text-xs"
                        />
                    </div>

                    {/* Type filter */}
                    <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(1) }}>
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                            <SelectValue placeholder={t('media.allTypes')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('media.allTypes')}</SelectItem>
                            <SelectItem value="image">{t('media.images')}</SelectItem>
                            <SelectItem value="video">{t('media.videos')}</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Sort */}
                    <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1) }}>
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                            <ArrowUpDown className="h-3 w-3 mr-1" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">{t('media.newest')}</SelectItem>
                            <SelectItem value="oldest">{t('media.oldest')}</SelectItem>
                            <SelectItem value="name">{t('media.name')}</SelectItem>
                            <SelectItem value="size">{t('media.size')}</SelectItem>
                        </SelectContent>
                    </Select>

                    <Separator orientation="vertical" className="h-6" />

                    {/* View mode */}
                    <div className="flex border rounded-md">
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-8 w-8 rounded-r-none"
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-8 w-8 rounded-l-none"
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <Separator orientation="vertical" className="h-6" />

                    {/* Actions */}
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => setShowCreateFolder(true)}
                    >
                        <FolderPlus className="h-3.5 w-3.5 mr-1" />
                        {t('media.newFolder')}
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                            <Upload className="h-3.5 w-3.5 mr-1" />
                        )}
                        {uploading ? t('media.uploading') : t('media.upload')}
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => handleUpload(e.target.files)}
                    />
                </div>
            </div>

            {/* ─── Bulk Action Bar ─── */}
            {someSelected && (
                <div className="border-b bg-primary/5 px-6 py-2 flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                        {t('media.selected').replace('{count}', String(selectedIds.size))}
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggleSelectAll}>
                        {allSelected ? t('media.deselectAll') : t('media.selectAll')}
                    </Button>
                    <Separator orientation="vertical" className="h-5" />
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={handleBulkDelete}>
                        <Trash2 className="h-3 w-3 mr-1" />
                        {t('media.delete')}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={openMoveDialog}>
                        <FolderInput className="h-3 w-3 mr-1" />
                        {t('media.move')}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs ml-auto"
                        onClick={() => setSelectedIds(new Set())}
                    >
                        <X className="h-3 w-3 mr-1" />
                        {t('media.clearSelection')}
                    </Button>
                </div>
            )}

            {/* ─── Breadcrumbs ─── */}
            <div className="px-6 py-2 flex items-center gap-1 text-xs text-muted-foreground border-b bg-muted/30">
                {breadcrumbs.map((bc, i) => (
                    <span key={i} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="h-3 w-3" />}
                        <button
                            onClick={() => navigateToBreadcrumb(i)}
                            className={`hover:text-foreground transition-colors ${i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''}`}
                        >
                            {i === 0 ? <Home className="h-3 w-3 inline mr-1" /> : null}
                            {bc.name}
                        </button>
                    </span>
                ))}
                <span className="ml-auto text-muted-foreground">
                    {folders.length} folder{folders.length !== 1 ? 's' : ''}, {total} file{total !== 1 ? 's' : ''}
                </span>
            </div>

            {/* ─── Content ─── */}
            <div
                className="flex-1 overflow-y-auto px-6 py-4"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        {/* Folders */}
                        {folders.length > 0 && (
                            <div className="mb-4">
                                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{t('media.folders')}</p>
                                <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2' : 'space-y-1'}>
                                    {folders.map((folder) => (
                                        <div
                                            key={folder.id}
                                            className={`group relative rounded-lg border bg-card hover:bg-primary/6 transition-colors cursor-pointer ${viewMode === 'grid' ? 'p-3 text-center' : 'p-2 flex items-center gap-3'}`}
                                            onDoubleClick={() => navigateToFolder(folder.id, folder.name)}
                                        >
                                            <div
                                                className={viewMode === 'grid' ? 'flex flex-col items-center gap-1' : 'flex items-center gap-3 flex-1'}
                                                onClick={() => navigateToFolder(folder.id, folder.name)}
                                            >
                                                <FolderOpen className={`text-amber-500 ${viewMode === 'grid' ? 'h-8 w-8' : 'h-4 w-4'}`} />
                                                <span className="text-xs font-medium truncate max-w-full">{folder.name}</span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {folder._count.media} files
                                                </span>
                                            </div>
                                            {/* Folder context menu */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-primary/8 transition-opacity">
                                                        <MoreVertical className="h-3 w-3" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-36">
                                                    <DropdownMenuItem onClick={() => setRenamingItem({ id: folder.id, type: 'folder', name: folder.name })}>
                                                        <Pencil className="h-3 w-3 mr-2" />
                                                        {t('media.rename')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleDeleteFolder(folder.id)} className="text-destructive">
                                                        <Trash2 className="h-3 w-3 mr-2" />
                                                        {t('media.delete')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Media Grid/List */}
                        {media.length === 0 && folders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <ImageIcon className="h-12 w-12 mb-3 opacity-30" />
                                <p className="text-sm font-medium">{t('media.noMedia')}</p>
                                <p className="text-xs mt-1">{t('media.noMediaDesc')}</p>
                                <Button
                                    size="sm"
                                    className="mt-4"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-3.5 w-3.5 mr-1" />
                                    {t('media.uploadFiles')}
                                </Button>
                            </div>
                        ) : media.length > 0 && (
                            <>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('media.files')}</p>
                                    <button
                                        onClick={toggleSelectAll}
                                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                    >
                                        {allSelected ? (
                                            <CheckSquare className="h-3.5 w-3.5" />
                                        ) : (
                                            <Square className="h-3.5 w-3.5" />
                                        )}
                                        {allSelected ? t('media.deselectAll') : t('media.selectAll')}
                                    </button>
                                </div>

                                {viewMode === 'grid' ? (
                                    /* ── Grid View ── */
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                                        {media.map((item) => {
                                            const selected = selectedIds.has(item.id)
                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`group relative rounded-lg overflow-hidden bg-muted aspect-square transition-all border-2 ${selected
                                                        ? 'border-primary ring-1 ring-primary/30'
                                                        : 'border-transparent hover:border-border'
                                                        }`}
                                                >
                                                    {/* Checkbox */}
                                                    <div className={`absolute top-1.5 left-1.5 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                        <Checkbox
                                                            checked={selected}
                                                            onCheckedChange={() => toggleSelect(item.id)}
                                                            onClick={(e) => toggleSelect(item.id, (e as unknown as MouseEvent).shiftKey)}
                                                            className="h-4 w-4 bg-background/80 backdrop-blur"
                                                        />
                                                    </div>

                                                    {/* Image/Video */}
                                                    <div
                                                        className="h-full w-full cursor-pointer"
                                                        onClick={(e) => {
                                                            // Don't open lightbox if clicking checkbox or menu
                                                            if ((e.target as HTMLElement).closest('[role="checkbox"]') || (e.target as HTMLElement).closest('button')) return
                                                            setLightboxItem(item)
                                                        }}
                                                    >
                                                        {isVideo(item) ? (
                                                            <div className="relative h-full w-full bg-muted">
                                                                <img
                                                                    src={item.thumbnailUrl || item.url}
                                                                    alt={item.originalName || ''}
                                                                    className="h-full w-full object-cover"
                                                                    onError={(e) => {
                                                                        // If thumbnail fails to load, show video icon fallback
                                                                        const target = e.currentTarget
                                                                        target.style.display = 'none'
                                                                        const fallback = target.parentElement?.querySelector('.thumb-fallback') as HTMLElement
                                                                        if (fallback) fallback.style.display = 'flex'
                                                                    }}
                                                                />
                                                                <div className="thumb-fallback absolute inset-0 items-center justify-center bg-muted" style={{ display: 'none' }}>
                                                                    <FileVideo className="h-8 w-8 text-muted-foreground" />
                                                                </div>
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <div className="h-7 w-7 rounded-full bg-black/60 flex items-center justify-center">
                                                                        <Play className="h-3.5 w-3.5 text-white ml-0.5" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <img
                                                                src={item.thumbnailUrl || item.url}
                                                                alt={item.originalName || ''}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        )}
                                                        {/* Zoom hint */}
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                                                <Maximize2 className="h-3.5 w-3.5 text-white" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Context menu */}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                                <MoreVertical className="h-3 w-3" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-36">
                                                            <DropdownMenuItem onClick={() => setRenamingItem({ id: item.id, type: 'media', name: item.originalName || '' })}>
                                                                <Pencil className="h-3 w-3 mr-2" />
                                                                Rename
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteMedia(item.id, item.originalName || 'media')}
                                                                className="text-destructive"
                                                            >
                                                                <Trash2 className="h-3 w-3 mr-2" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>

                                                    {/* Filename */}
                                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-4">
                                                        <p className="text-[9px] text-white truncate">{item.originalName}</p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    /* ── List View ── */
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="p-2 w-8">
                                                        <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} className="h-3.5 w-3.5" />
                                                    </th>
                                                    <th className="p-2 text-left w-10"></th>
                                                    <th className="p-2 text-left font-medium">{t('media.name')}</th>
                                                    <th className="p-2 text-left font-medium w-20">{t('media.type')}</th>
                                                    <th className="p-2 text-left font-medium w-20">{t('media.size')}</th>
                                                    <th className="p-2 text-left font-medium w-24">{t('media.date')}</th>
                                                    <th className="p-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {media.map((item) => {
                                                    const selected = selectedIds.has(item.id)
                                                    return (
                                                        <tr
                                                            key={item.id}
                                                            className={`border-t hover:bg-primary/4 transition-colors ${selected ? 'bg-primary/5' : ''}`}
                                                        >
                                                            <td className="p-2">
                                                                <Checkbox
                                                                    checked={selected}
                                                                    onCheckedChange={() => toggleSelect(item.id)}
                                                                    className="h-3.5 w-3.5"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <div
                                                                    className="h-8 w-8 rounded bg-muted overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                                                                    onClick={() => setLightboxItem(item)}
                                                                >
                                                                    <img
                                                                        src={item.thumbnailUrl || item.url}
                                                                        alt=""
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="p-2 font-medium truncate max-w-[200px]">
                                                                {item.originalName}
                                                            </td>
                                                            <td className="p-2 text-muted-foreground">
                                                                <Badge variant="outline" className="text-[10px] px-1.5">
                                                                    {isVideo(item) ? (
                                                                        <><FileVideo className="h-2.5 w-2.5 mr-0.5" /> Video</>
                                                                    ) : (
                                                                        <><ImageIcon className="h-2.5 w-2.5 mr-0.5" /> Image</>
                                                                    )}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-2 text-muted-foreground">{formatBytes(item.fileSize)}</td>
                                                            <td className="p-2 text-muted-foreground">{formatDate(item.createdAt)}</td>
                                                            <td className="p-2">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                            <MoreVertical className="h-3 w-3" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-36">
                                                                        <DropdownMenuItem onClick={() => setRenamingItem({ id: item.id, type: 'media', name: item.originalName || '' })}>
                                                                            <Pencil className="h-3 w-3 mr-2" />
                                                                            {t('media.rename')}
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            onClick={() => handleDeleteMedia(item.id, item.originalName || '')}
                                                                            className="text-destructive"
                                                                        >
                                                                            <Trash2 className="h-3 w-3 mr-2" />
                                                                            {t('media.delete')}
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-4">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={page <= 1}
                                            onClick={() => setPage((p) => p - 1)}
                                            className="h-7 text-xs"
                                        >
                                            {t('common.back')}
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                            Page {page} of {totalPages}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={page >= totalPages}
                                            onClick={() => setPage((p) => p + 1)}
                                            className="h-7 text-xs"
                                        >
                                            {t('common.next')}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* ─── Lightbox Overlay ─── */}
            {lightboxItem && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setLightboxItem(null) }}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setLightboxItem(null)
                        if (e.key === 'ArrowRight') {
                            const idx = media.findIndex(m => m.id === lightboxItem.id)
                            if (idx < media.length - 1) setLightboxItem(media[idx + 1])
                        }
                        if (e.key === 'ArrowLeft') {
                            const idx = media.findIndex(m => m.id === lightboxItem.id)
                            if (idx > 0) setLightboxItem(media[idx - 1])
                        }
                    }}
                    tabIndex={0}
                    ref={(el) => el?.focus()}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setLightboxItem(null)}
                        className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {/* Previous */}
                    {media.findIndex(m => m.id === lightboxItem.id) > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                const idx = media.findIndex(m => m.id === lightboxItem.id)
                                setLightboxItem(media[idx - 1])
                            }}
                            className="absolute left-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                    )}

                    {/* Next */}
                    {media.findIndex(m => m.id === lightboxItem.id) < media.length - 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                const idx = media.findIndex(m => m.id === lightboxItem.id)
                                setLightboxItem(media[idx + 1])
                            }}
                            className="absolute right-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    )}

                    {/* Content */}
                    <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3">
                        {isVideo(lightboxItem) ? (
                            <video
                                src={lightboxItem.url}
                                controls
                                autoPlay
                                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
                            />
                        ) : (
                            <img
                                src={lightboxItem.url}
                                alt={lightboxItem.originalName || ''}
                                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
                            />
                        )}
                        {/* Info bar */}
                        <div className="flex items-center gap-3 text-white/80 text-xs">
                            <span className="font-medium text-white">{lightboxItem.originalName}</span>
                            {lightboxItem.fileSize && (
                                <span className="text-white/50">{formatBytes(lightboxItem.fileSize)}</span>
                            )}
                            <span className="text-white/30">
                                {media.findIndex(m => m.id === lightboxItem.id) + 1} / {media.length}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Create Folder Dialog ─── */}
            <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-sm flex items-center gap-2">
                            <FolderPlus className="h-4 w-4" />
                            {t('media.createFolderTitle')}
                        </DialogTitle>
                    </DialogHeader>
                    <Input
                        placeholder={t('media.folderNamePlaceholder')}
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                            {t('media.create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Rename Dialog ─── */}
            <Dialog open={!!renamingItem} onOpenChange={(open) => !open && setRenamingItem(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-sm flex items-center gap-2">
                            <Pencil className="h-4 w-4" />
                            {t('media.renameTitle')}
                        </DialogTitle>
                    </DialogHeader>
                    <Input
                        value={renamingItem?.name || ''}
                        onChange={(e) =>
                            setRenamingItem((prev) => (prev ? { ...prev, name: e.target.value } : null))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setRenamingItem(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button size="sm" onClick={handleRename}>
                            {t('media.rename')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Move Dialog ─── */}
            <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-sm flex items-center gap-2">
                            <FolderInput className="h-4 w-4" />
                            {t('media.moveTitle')}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        <button
                            onClick={() => setMoveTargetFolder(null)}
                            className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center gap-2 transition-colors ${moveTargetFolder === null ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                        >
                            <Home className="h-3 w-3" />
                            {t('media.moveRoot')}
                        </button>
                        {allFolders.map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setMoveTargetFolder(f.id)}
                                className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center gap-2 transition-colors ${moveTargetFolder === f.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                            >
                                <Folder className="h-3 w-3 text-amber-500" />
                                {f.name}
                                <span className="text-muted-foreground ml-auto">{f._count.media} files</span>
                            </button>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setShowMoveDialog(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button size="sm" onClick={handleBulkMove}>
                            {t('media.move')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
