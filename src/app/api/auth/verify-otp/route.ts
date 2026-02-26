import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/auth/verify-otp — Step 2: verify OTP + create user + assign Free plan
export async function POST(req: NextRequest) {
    try {
        const { email, code, locale } = await req.json()
        const isVi = locale === 'vi'

        if (!email || !code) {
            return NextResponse.json(
                { error: isVi ? 'Thiếu email hoặc mã xác nhận' : 'Email and code are required' },
                { status: 400 }
            )
        }

        // Find the OTP token
        const otp = await prisma.otpToken.findFirst({
            where: { email: email.toLowerCase().trim(), used: false },
            orderBy: { createdAt: 'desc' },
        })

        if (!otp) {
            return NextResponse.json(
                { error: isVi ? 'Không tìm thấy mã xác nhận. Hãy đăng ký lại.' : 'No pending verification found. Please register again.' },
                { status: 400 }
            )
        }

        if (otp.expiresAt < new Date()) {
            return NextResponse.json(
                { error: isVi ? 'Mã xác nhận đã hết hạn. Hãy đăng ký lại.' : 'Verification code has expired. Please request a new one.' },
                { status: 400 }
            )
        }

        if (otp.code !== code.trim()) {
            return NextResponse.json(
                { error: isVi ? 'Mã xác nhận không đúng' : 'Incorrect verification code' },
                { status: 400 }
            )
        }

        // Check email still not taken (race condition guard)
        const existing = await prisma.user.findUnique({ where: { email: otp.email } })
        if (existing) {
            return NextResponse.json(
                { error: isVi ? 'Email này đã được sử dụng' : 'An account with this email already exists' },
                { status: 409 }
            )
        }

        // Find Free plan
        const freePlan = await prisma.plan.findFirst({
            where: { OR: [{ name: 'Free' }, { priceMonthly: 0 }] },
            orderBy: { priceMonthly: 'asc' },
        })

        // Create user + subscription in a transaction
        const user = await prisma.$transaction(async (tx) => {
            // Read trial config from SiteSettings
            const siteSettings = await (tx as any).siteSettings.findUnique({ where: { id: 'default' } })
            const trialEnabled = siteSettings?.trialEnabled ?? true
            const trialDays = siteSettings?.trialDays ?? 14

            // Calculate trial end date (null if trial disabled)
            let trialEndsAt: Date | null = null
            if (trialEnabled && trialDays > 0) {
                trialEndsAt = new Date()
                trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)
            }

            const newUser = await tx.user.create({
                data: {
                    email: otp.email,
                    name: `${otp.firstName} ${otp.lastName}`,
                    firstName: otp.firstName,
                    lastName: otp.lastName,
                    passwordHash: otp.password,
                    role: 'MANAGER',
                    isActive: true,
                    emailVerified: new Date(),
                    trialEndsAt, // dynamic trial from SiteSettings
                },
            })

            // Assign Free plan subscription
            if (freePlan) {
                const now = new Date()
                await tx.subscription.create({
                    data: {
                        userId: newUser.id,
                        planId: freePlan.id,
                        status: 'ACTIVE',
                        currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
                    },
                })
            }

            // Mark OTP as used
            await tx.otpToken.update({
                where: { id: otp.id },
                data: { used: true },
            })

            return newUser
        })

        return NextResponse.json({ success: true, userId: user.id })
    } catch (error) {
        console.error('[verify-otp] error:', error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }
}
