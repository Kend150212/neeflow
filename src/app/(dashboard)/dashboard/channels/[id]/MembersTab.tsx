'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import {
    Users,
    UserPlus,
    Shield,
    ChevronDown,
    ChevronUp,
    Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

interface MembersTabProps {
    channelId: string
    members: any[]
    setMembers: (v: any[] | ((prev: any[]) => any[])) => void
    isAdmin: boolean
}

export default function MembersTab({
    channelId,
    members,
    setMembers,
    isAdmin,
}: MembersTabProps) {
    const t = useTranslation()
    const [addingMember, setAddingMember] = useState(false)
    const [allUsers, setAllUsers] = useState<any[]>([])
    const [selectedUserId, setSelectedUserId] = useState('')
    const [selectedRole, setSelectedRole] = useState('MANAGER')
    const [expandedMember, setExpandedMember] = useState<string | null>(null)
    const [inviteEmail, setInviteEmail] = useState('')
    const [sendingInvite, setSendingInvite] = useState(false)

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base">{t('channels.members.title')}</CardTitle>
                        <CardDescription>{t('channels.members.desc')}</CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setAddingMember(!addingMember)
                            if (!addingMember && isAdmin && allUsers.length === 0) {
                                fetch('/api/admin/users').then(r => r.ok ? r.json() : []).then(data => setAllUsers(data)).catch(() => { })
                            }
                        }}
                        className="gap-1.5"
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        {t('channels.members.addMember')}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add member form */}
                {addingMember && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                        {/* Admin: Select existing user */}
                        {isAdmin && (
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('channels.members.selectUser')}</label>
                                    <select
                                        value={selectedUserId}
                                        onChange={(e) => setSelectedUserId(e.target.value)}
                                        className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                    >
                                        <option value="">{t('channels.members.selectUser')}</option>
                                        {allUsers
                                            .filter(u => !members.some(m => m.userId === u.id))
                                            .map(u => (
                                                <option key={u.id} value={u.id}>{u.name ? `${u.name} (${u.email})` : u.email}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('channels.members.role')}</label>
                                    <select
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                        className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                    >
                                        <option value="OWNER">Owner</option>
                                        <option value="MANAGER">Manager</option>
                                        <option value="STAFF">Staff</option>
                                        <option value="CUSTOMER">Customer</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Admin: Add by user button */}
                        {isAdmin && selectedUserId && (
                            <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(''); setAddingMember(false) }}>
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={async () => {
                                        try {
                                            const res = await fetch(`/api/admin/channels/${channelId}/members`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
                                            })
                                            if (res.status === 409) { toast.error(t('channels.members.alreadyMember')); return }
                                            if (!res.ok) throw new Error()
                                            const member = await res.json()
                                            setMembers(prev => [...prev, member])
                                            setSelectedUserId('')
                                            setAddingMember(false)
                                            toast.success(t('channels.members.added'))
                                        } catch { toast.error(t('channels.members.addFailed')) }
                                    }}
                                >
                                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                    {t('channels.members.addMember')}
                                </Button>
                            </div>
                        )}

                        {/* Divider for admin */}
                        {isAdmin && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="flex-1 border-t" />
                                <span>{t('channels.members.orInviteByEmail')}</span>
                                <div className="flex-1 border-t" />
                            </div>
                        )}

                        {/* Email invite (all users) */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('channels.members.inviteByEmail')}</label>
                                <Input
                                    type="email"
                                    placeholder={t('channels.members.emailPlaceholder')}
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('channels.members.role')}</label>
                                <select
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="OWNER">Owner</option>
                                    <option value="MANAGER">Manager</option>
                                    <option value="STAFF">Staff</option>
                                    <option value="CUSTOMER">Customer</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => { setInviteEmail(''); setAddingMember(false) }}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                size="sm"
                                disabled={!inviteEmail || sendingInvite}
                                onClick={async () => {
                                    setSendingInvite(true)
                                    try {
                                        const res = await fetch(`/api/admin/channels/${channelId}/members`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ email: inviteEmail, role: selectedRole }),
                                        })
                                        if (res.status === 409) { toast.error(t('channels.members.alreadyMember')); return }
                                        if (!res.ok) throw new Error()
                                        const member = await res.json()
                                        setMembers(prev => [...prev, member])
                                        setInviteEmail('')
                                        setAddingMember(false)
                                        toast.success(t('channels.members.inviteSent'))
                                    } catch { toast.error(t('channels.members.inviteFailed')) }
                                    finally { setSendingInvite(false) }
                                }}
                            >
                                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                {sendingInvite ? t('channels.members.sending') : t('channels.members.sendInvite')}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Members list */}
                {members.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">{t('channels.members.noMembers')}</p>
                        <p className="text-xs mt-1">{t('channels.members.noMembersDesc')}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {members.map((member) => (
                            <div key={member.id} className="border rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                            {member.user?.name?.[0]?.toUpperCase() || member.user?.email?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{member.user?.name || member.user?.email}</p>
                                            <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.role === 'ADMIN' ? 'bg-red-500/10 text-red-500' :
                                            member.role === 'OWNER' ? 'bg-amber-500/10 text-amber-500' :
                                                member.role === 'MANAGER' ? 'bg-blue-500/10 text-blue-500' :
                                                    member.role === 'STAFF' ? 'bg-indigo-500/10 text-indigo-400' :
                                                        'bg-neutral-500/10 text-neutral-400'
                                            }`}>
                                            {member.role}
                                        </span>
                                        {isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 gap-1"
                                                onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                                            >
                                                <Shield className="h-3.5 w-3.5" />
                                                {expandedMember === member.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                            </Button>
                                        )}
                                        {isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                                onClick={async () => {
                                                    try {
                                                        await fetch(`/api/admin/channels/${channelId}/members?memberId=${member.id}`, { method: 'DELETE' })
                                                        setMembers(prev => prev.filter(m => m.id !== member.id))
                                                        toast.success(t('channels.members.removed'))
                                                    } catch {
                                                        toast.error(t('channels.members.removeFailed'))
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded permissions */}
                                {expandedMember === member.id && (
                                    <div className="border-t px-4 py-3 bg-muted/20">
                                        <p className="text-xs font-medium text-muted-foreground mb-3">
                                            <Shield className="h-3 w-3 inline mr-1" />
                                            {t('channels.members.permissions')}
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {[
                                                'canCreatePost', 'canEditPost', 'canDeletePost', 'canApprovePost',
                                                'canSchedulePost', 'canUploadMedia', 'canDeleteMedia', 'canViewMedia',
                                                'canCreateEmail', 'canManageContacts', 'canViewReports', 'canEditSettings',
                                            ].map((perm) => (
                                                <label
                                                    key={perm}
                                                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-2 py-1.5 transition-colors"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={member.permission?.[perm] ?? false}
                                                        onChange={async (e) => {
                                                            const newVal = e.target.checked
                                                            // Optimistic update
                                                            setMembers(prev => prev.map(m =>
                                                                m.id === member.id
                                                                    ? { ...m, permission: { ...m.permission, [perm]: newVal } }
                                                                    : m
                                                            ))
                                                            try {
                                                                await fetch(`/api/admin/channels/${channelId}/members/${member.id}`, {
                                                                    method: 'PUT',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ permissions: { ...member.permission, [perm]: newVal } }),
                                                                })
                                                            } catch {
                                                                // Revert on error
                                                                setMembers(prev => prev.map(m =>
                                                                    m.id === member.id
                                                                        ? { ...m, permission: { ...m.permission, [perm]: !newVal } }
                                                                        : m
                                                                ))
                                                                toast.error(t('channels.members.updateFailed'))
                                                            }
                                                        }}
                                                        className="rounded border-muted-foreground/30"
                                                    />
                                                    <span>{t(`channels.members.permissionLabels.${perm}`)}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {/* Reset to defaults */}
                                        <div className="mt-2 flex justify-end">
                                            <button
                                                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch(`/api/admin/channels/${channelId}/members/${member.id}/reset-permissions`, { method: 'POST' })
                                                        if (!res.ok) throw new Error()
                                                        const updated = await res.json()
                                                        setMembers(prev => prev.map(m => m.id === member.id ? updated : m))
                                                        toast.success('Permissions reset to role defaults')
                                                    } catch {
                                                        toast.error('Failed to reset permissions')
                                                    }
                                                }}
                                            >
                                                Reset to role defaults
                                            </button>
                                        </div>
                                    </div>
                                )}

                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
