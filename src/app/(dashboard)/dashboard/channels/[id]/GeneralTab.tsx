'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import {
    Sparkles,
    Loader2,
    Plus,
    Trash2,
    Phone,
    MapPin,
    Globe as Globe2,
    Target,
    Lightbulb,
    ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface GeneralTabProps {
    channelId: string
    displayName: string
    setDisplayName: (v: string) => void
    description: string
    setDescription: (v: string) => void
    language: string
    setLanguage: (v: string) => void
    timezone: string
    setTimezone: (v: string) => void
    isActive: boolean
    setIsActive: (v: boolean) => void
    notificationEmail: string
    setNotificationEmail: (v: string) => void
    requireApproval: 'none' | 'optional' | 'required'
    setRequireApproval: (v: 'none' | 'optional' | 'required') => void
    brandTargetAudience: string
    setBrandTargetAudience: (v: string) => void
    brandContentTypes: string
    setBrandContentTypes: (v: string) => void
    brandValues: string
    setBrandValues: (v: string) => void
    brandCommStyle: string
    setBrandCommStyle: (v: string) => void
    bizPhone: string
    setBizPhone: (v: string) => void
    bizAddress: string
    setBizAddress: (v: string) => void
    bizWebsite: string
    setBizWebsite: (v: string) => void
    bizSocials: Record<string, string>
    setBizSocials: (v: Record<string, string>) => void
    bizCustomLinks: { label: string; url: string }[]
    setBizCustomLinks: (v: { label: string; url: string }[]) => void
    generatingDesc: boolean
    handleGenerateDescription: () => void
    handleAnalyze: () => void
    analyzing: boolean
    isAdmin: boolean
    requireOwnApiKey: boolean
    setRequireOwnApiKey: (v: boolean) => void
    aiProvider: string
    aiModel: string
}

export default function GeneralTab({
    channelId,
    displayName,
    setDisplayName,
    description,
    setDescription,
    language,
    setLanguage,
    timezone,
    setTimezone,
    isActive,
    setIsActive,
    notificationEmail,
    setNotificationEmail,
    requireApproval,
    setRequireApproval,
    brandTargetAudience,
    setBrandTargetAudience,
    brandContentTypes,
    setBrandContentTypes,
    brandValues,
    setBrandValues,
    brandCommStyle,
    setBrandCommStyle,
    bizPhone,
    setBizPhone,
    bizAddress,
    setBizAddress,
    bizWebsite,
    setBizWebsite,
    bizSocials,
    setBizSocials,
    bizCustomLinks,
    setBizCustomLinks,
    generatingDesc,
    handleGenerateDescription,
    handleAnalyze,
    analyzing,
    isAdmin,
    requireOwnApiKey,
    setRequireOwnApiKey,
    aiProvider,
    aiModel,
}: GeneralTabProps) {
    const t = useTranslation()
    const [newCustomLabel, setNewCustomLabel] = useState('')
    const [newCustomUrl, setNewCustomUrl] = useState('')

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{t('channels.general.title')}</CardTitle>
                <CardDescription>{t('channels.general.desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Display Name */}
                <div className="space-y-2">
                    <Label>{t('channels.general.displayName')}</Label>
                    <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t('channels.general.displayNamePlaceholder')}
                    />
                </div>

                {/* Language + Timezone */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>{t('channels.general.language')}</Label>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="vi">Tiếng Việt</SelectItem>
                                <SelectItem value="ja">日本語</SelectItem>
                                <SelectItem value="ko">한국어</SelectItem>
                                <SelectItem value="zh">中文</SelectItem>
                                <SelectItem value="th">ภาษาไทย</SelectItem>
                                <SelectItem value="fr">Français</SelectItem>
                                <SelectItem value="de">Deutsch</SelectItem>
                                <SelectItem value="es">Español</SelectItem>
                                <SelectItem value="pt">Português</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('channels.general.timezone')}</Label>
                        <Select value={timezone} onValueChange={setTimezone}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="UTC">UTC</SelectItem>
                                <SelectItem value="Asia/Ho_Chi_Minh">Asia/Ho Chi Minh (ICT)</SelectItem>
                                <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                                <SelectItem value="Asia/Seoul">Asia/Seoul (KST)</SelectItem>
                                <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST)</SelectItem>
                                <SelectItem value="Asia/Bangkok">Asia/Bangkok (ICT)</SelectItem>
                                <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                                <SelectItem value="America/Los_Angeles">America/Los Angeles (PST)</SelectItem>
                                <SelectItem value="America/Chicago">America/Chicago (CST)</SelectItem>
                                <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                                <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
                                <SelectItem value="Europe/Berlin">Europe/Berlin (CET)</SelectItem>
                                <SelectItem value="Australia/Sydney">Australia/Sydney (AEDT)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Separator />

                {/* Brand Profile */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-medium">{t('channels.general.brandProfile')}</Label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{t('channels.general.targetAudience')}</Label>
                            <Input
                                value={brandTargetAudience}
                                onChange={(e) => setBrandTargetAudience(e.target.value)}
                                placeholder={t('channels.general.targetAudiencePlaceholder')}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{t('channels.general.contentTypes')}</Label>
                            <Input
                                value={brandContentTypes}
                                onChange={(e) => setBrandContentTypes(e.target.value)}
                                placeholder={t('channels.general.contentTypesPlaceholder')}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{t('channels.general.brandValuesLabel')}</Label>
                            <Input
                                value={brandValues}
                                onChange={(e) => setBrandValues(e.target.value)}
                                placeholder={t('channels.general.brandValuesPlaceholder')}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{t('channels.general.communicationStyle')}</Label>
                            <Input
                                value={brandCommStyle}
                                onChange={(e) => setBrandCommStyle(e.target.value)}
                                placeholder={t('channels.general.communicationStylePlaceholder')}
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Description */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>{t('channels.general.description')}</Label>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateDescription}
                            disabled={generatingDesc || !displayName}
                        >
                            {generatingDesc ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> {t('channels.ai.generating')}</>
                            ) : (
                                <><Sparkles className="h-4 w-4 mr-1" /> {t('channels.ai.generateDesc')}</>
                            )}
                        </Button>
                    </div>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('channels.general.descriptionPlaceholder')}
                        rows={4}
                    />
                </div>

                {/* AI Analysis trigger */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <Lightbulb className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-medium">{t('channels.ai.analyzeTitle')}</p>
                        <p className="text-xs text-muted-foreground">{t('channels.ai.analyzeDesc')}</p>
                    </div>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleAnalyze}
                        disabled={analyzing || !description}
                        className="gap-1.5"
                    >
                        {analyzing ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.ai.analyzing')}</>
                        ) : (
                            <><Sparkles className="h-3.5 w-3.5" /> {t('channels.ai.analyze')}</>
                        )}
                    </Button>
                </div>

                {/* AI Setup notice */}
                {!aiProvider && (
                    <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                            {t('channels.ai.noProviderNotice')}
                        </p>
                    </div>
                )}

                <Separator />

                {/* Notification Email */}
                <div className="space-y-2">
                    <Label>{t('channels.general.notificationEmail')}</Label>
                    <Input
                        type="email"
                        value={notificationEmail}
                        onChange={(e) => setNotificationEmail(e.target.value)}
                        placeholder={t('channels.general.notificationEmailPlaceholder')}
                    />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                        <Label>{t('channels.general.activeStatus')}</Label>
                        <p className="text-xs text-muted-foreground">{t('channels.general.activeStatusDesc')}</p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                {/* Approval Mode */}
                <div className="space-y-2">
                    <Label>{t('channels.general.approvalMode')}</Label>
                    <Select value={requireApproval} onValueChange={(v) => setRequireApproval(v as 'none' | 'optional' | 'required')}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">{t('channels.general.approvalNone')}</SelectItem>
                            <SelectItem value="optional">{t('channels.general.approvalOptional')}</SelectItem>
                            <SelectItem value="required">{t('channels.general.approvalRequired')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Require Own API Key (Admin only) */}
                {isAdmin && (
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                            <Label>{t('channels.general.requireOwnApiKey')}</Label>
                            <p className="text-xs text-muted-foreground">{t('channels.general.requireOwnApiKeyDesc')}</p>
                        </div>
                        <Switch checked={requireOwnApiKey} onCheckedChange={setRequireOwnApiKey} />
                    </div>
                )}

                <Separator />

                {/* Business Info */}
                <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('channels.general.businessInfo')}</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {t('channels.general.phone')}
                            </Label>
                            <Input value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} placeholder="+1 234 567 890" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {t('channels.general.address')}
                            </Label>
                            <Input value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} placeholder="123 Main St, City" />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <Globe2 className="h-3 w-3" /> {t('channels.general.website')}
                            </Label>
                            <Input value={bizWebsite} onChange={(e) => setBizWebsite(e.target.value)} placeholder="https://example.com" />
                        </div>
                    </div>

                    {/* Social links */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">{t('channels.general.socialLinks')}</Label>
                        {['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin', 'x'].map((platform) => (
                            <div key={platform} className="flex items-center gap-2">
                                <Badge variant="outline" className="w-20 justify-center text-[10px] shrink-0 capitalize">{platform}</Badge>
                                <Input
                                    value={bizSocials[platform] || ''}
                                    onChange={(e) => setBizSocials({ ...bizSocials, [platform]: e.target.value })}
                                    placeholder={`https://${platform}.com/...`}
                                    className="text-xs h-8"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Custom links */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">{t('channels.general.customLinks')}</Label>
                        {bizCustomLinks.map((link, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    value={link.label}
                                    onChange={(e) => {
                                        const updated = [...bizCustomLinks]
                                        updated[i] = { ...link, label: e.target.value }
                                        setBizCustomLinks(updated)
                                    }}
                                    placeholder="Label"
                                    className="w-32 text-xs h-8"
                                />
                                <Input
                                    value={link.url}
                                    onChange={(e) => {
                                        const updated = [...bizCustomLinks]
                                        updated[i] = { ...link, url: e.target.value }
                                        setBizCustomLinks(updated)
                                    }}
                                    placeholder="https://..."
                                    className="flex-1 text-xs h-8"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive shrink-0"
                                    onClick={() => setBizCustomLinks(bizCustomLinks.filter((_, idx) => idx !== i))}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                        <div className="flex items-center gap-2">
                            <Input
                                value={newCustomLabel}
                                onChange={(e) => setNewCustomLabel(e.target.value)}
                                placeholder="Label"
                                className="w-32 text-xs h-8"
                            />
                            <Input
                                value={newCustomUrl}
                                onChange={(e) => setNewCustomUrl(e.target.value)}
                                placeholder="https://..."
                                className="flex-1 text-xs h-8"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 shrink-0"
                                disabled={!newCustomLabel || !newCustomUrl}
                                onClick={() => {
                                    setBizCustomLinks([...bizCustomLinks, { label: newCustomLabel, url: newCustomUrl }])
                                    setNewCustomLabel('')
                                    setNewCustomUrl('')
                                }}
                            >
                                <Plus className="h-3 w-3" /> Add
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
