// Force trust host for production behind reverse proxy (Nginx)
// Use bracket notation to prevent Turbopack from inlining process.env at build time
const _env = process.env
const _trustKey = 'AUTH_TRUST_HOST'
_env[_trustKey] = 'true'

import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

type UserRoleType = 'ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'CUSTOMER'

declare module 'next-auth' {
    interface User {
        role: UserRoleType
        isActive: boolean
    }
    interface Session {
        user: {
            id: string
            email: string
            name: string
            role: UserRoleType
            isActive: boolean
            image?: string
        }
    }
}

declare module '@auth/core/jwt' {
    interface JWT {
        role: UserRoleType
        isActive: boolean
    }
}

// ─── Dynamic Google OAuth credentials from DB ──────────────────
// Cache credentials for 60 seconds to avoid DB read on every request
let _googleCache: { clientId: string; clientSecret: string; fetchedAt: number } | null = null
const CACHE_TTL = 60_000 // 60 seconds

async function getGoogleCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
    // Check cache first
    if (_googleCache && Date.now() - _googleCache.fetchedAt < CACHE_TTL) {
        return { clientId: _googleCache.clientId, clientSecret: _googleCache.clientSecret }
    }

    // Check process.env (set by instrumentation.ts at startup)
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        _googleCache = {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            fetchedAt: Date.now(),
        }
        return { clientId: _googleCache.clientId, clientSecret: _googleCache.clientSecret }
    }

    // Fallback: load from DB dynamically
    try {
        const integration = await prisma.apiIntegration.findFirst({
            where: { provider: 'google_oauth', status: 'ACTIVE' },
        })
        if (integration) {
            const config = integration.config as Record<string, string> | null
            const clientId = config?.clientId
            const clientSecret = integration.apiKeyEncrypted
                ? decrypt(integration.apiKeyEncrypted)
                : null

            if (clientId && clientSecret) {
                // Update process.env so subsequent requests within the same server instance are fast
                process.env.GOOGLE_CLIENT_ID = clientId
                process.env.GOOGLE_CLIENT_SECRET = clientSecret
                _googleCache = { clientId, clientSecret, fetchedAt: Date.now() }
                return { clientId, clientSecret }
            }
        }
    } catch (err) {
        console.error('[auth] Failed to load Google OAuth credentials from DB:', err)
    }

    return null
}

// Providers are defined inline in NextAuth config so they are evaluated
// after instrumentation.ts has loaded credentials into process.env

export const { handlers, auth, signIn, signOut } = NextAuth({
    trustHost: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providers: [
        Credentials({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                })

                if (!user || !user.isActive) return null
                if (!user.passwordHash) return null

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.passwordHash
                )
                if (!isValid) return null

                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastLoginAt: new Date() },
                })

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isActive: user.isActive,
                    image: user.image,
                }
            },
        }),
        // Google provider is conditionally added based on env vars loaded at startup
        // Dynamic DB loading happens in the signIn callback below
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? [
                Google({
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    allowDangerousEmailAccountLinking: true,
                }) as never,
            ]
            : [
                // Always include Google provider — fetch credentials dynamically if not in env
                Google({
                    clientId: 'placeholder',
                    clientSecret: 'placeholder',
                    allowDangerousEmailAccountLinking: true,
                }) as never,
            ]),
    ],
    adapter: PrismaAdapter(prisma) as any,
    session: { strategy: 'jwt' },
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async signIn({ user, account }) {
            // On Google sign-in: dynamically verify and load credentials from DB
            if (account?.provider === 'google') {
                // Validate that Google OAuth is actually configured
                const creds = await getGoogleCredentials()
                if (!creds) {
                    console.error('[auth] Google sign-in attempted but no credentials configured')
                    return false // Block sign-in if not configured
                }

                const existing = await prisma.user.findUnique({
                    where: { email: user.email! },
                    select: { id: true, isActive: true },
                })

                if (existing && !existing.isActive) {
                    return false // Block inactive accounts
                }

                if (!existing) {
                    // New user via Google — assign Free plan
                    const freePlan = await prisma.plan.findFirst({
                        where: { OR: [{ name: 'Free' }, { priceMonthly: 0 }] },
                        orderBy: { priceMonthly: 'asc' },
                    })
                    const now = new Date()

                    // User is created by PrismaAdapter, we just need to assign the plan after
                    // Use a short delay approach: set role to MANAGER in the update callback
                    if (freePlan) {
                        // Schedule plan assignment after user creation via adapter
                        setTimeout(async () => {
                            try {
                                const newUser = await prisma.user.findUnique({ where: { email: user.email! } })
                                if (newUser && !newUser.role) {
                                    await prisma.user.update({
                                        where: { id: newUser.id },
                                        data: { role: 'MANAGER' },
                                    })
                                }
                                const sub = await prisma.subscription.findUnique({ where: { userId: newUser!.id } })
                                if (!sub) {
                                    await prisma.subscription.create({
                                        data: {
                                            userId: newUser!.id,
                                            planId: freePlan.id,
                                            status: 'ACTIVE',
                                            currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
                                        },
                                    })
                                }
                            } catch (e) {
                                console.error('[Google signIn] plan assignment error:', e)
                            }
                        }, 500)
                    }
                }
            }
            return true
        },
        async jwt({ token, user, trigger }) {
            if (user) {
                token.role = (user.role as UserRoleType) ?? 'MANAGER'
                token.isActive = user.isActive ?? true
            }
            // Re-fetch role on explicit token update (e.g. after profile change)
            if (trigger === 'update') {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.sub! },
                    select: { role: true, isActive: true, name: true },
                })
                if (dbUser) {
                    token.role = dbUser.role as UserRoleType
                    token.isActive = dbUser.isActive
                }
            }
            return token
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.sub!
                session.user.role = token.role as UserRoleType
                session.user.isActive = token.isActive as boolean
            }
            return session
        },
    },
})

