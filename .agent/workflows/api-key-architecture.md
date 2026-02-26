---
description: How AI API keys work across the platform - storage, resolution, and access rules
---

# AI API Key Architecture

## 3 Levels of API Key Storage

| Level | DB Table | UI Location | Who Sets It |
|-------|----------|-------------|-------------|
| **User API Key** | `userApiKey` | `/dashboard/api-keys` | Each user (admin) |
| **Channel Config** | `channel.defaultAiProvider` + `defaultAiModel` | Channel → AI Setup tab | Channel admin |
| **Global API Hub** | `apiIntegration` | `/admin/api-hub` | Platform admin only |

## How It Works

1. **User** goes to `/dashboard/api-keys` → adds Gemini/OpenAI/etc API key → stored in `userApiKey` table (encrypted)
2. **Channel AI Setup** tab shows **only providers the user has configured** → user picks provider + model → saved as `channel.defaultAiProvider` and `channel.defaultAiModel` (NO key stored on channel)
3. When AI is needed → system finds the **user's API key** for the provider the channel selected

## Key Resolution Order (for all AI features)

```
1. Channel's own AI key (channel.aiApiKeyEncrypted) — rarely used, no UI for this
2. Current user's userApiKey (matching channel.defaultAiProvider)
3. Current user's default userApiKey
4. Current user's any active userApiKey
```

## Pipeline (Cron) Key Resolution

Pipeline runs without a user session, so it uses:

```
1. Channel's own AI key (if exists)
2. Uploader's userApiKey (job.uploadedBy email → user → their keys)
3. Channel admin's userApiKey (channelMember role=ADMIN → their keys)
4. ERROR — no key found
```

> **RULE: Global API Hub keys are NEVER used by non-admin users or pipeline jobs.**
> Global keys in `apiIntegration` are only for admin-level system features.

## Key Files

- `src/lib/ai-caller.ts` — shared AI caller (Gemini, OpenAI, OpenRouter)
- `src/app/api/cron/process-content-jobs/route.ts` — pipeline worker with key resolution
- `src/app/api/admin/posts/customize-content/route.ts` — example of key resolution with session
- `src/app/api/admin/posts/generate-metadata/route.ts` — same pattern
- `prisma/schema.prisma` — `UserApiKey`, `Channel`, `ApiIntegration` models
