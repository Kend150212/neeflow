import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// One-time route: upload TikTok domain verification file to R2
// DELETE this file after verification is confirmed.
// Access: GET /api/admin/tiktok-verify

const VERIFICATION_TOKEN = 'tiktok-developers-site-verification=WNcdzfqcL1l7ydxqgcJNKahevXq64mPT'
const FILE_KEY = 'tiktok-developers-site-verification.txt'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { uploadToR2 } = await import('@/lib/r2')
        const fileBuffer = Buffer.from(VERIFICATION_TOKEN, 'utf-8')
        const publicUrl = await uploadToR2(fileBuffer, FILE_KEY, 'text/plain')
        return NextResponse.json({
            ok: true,
            message: 'Verification file uploaded to R2.',
            url: publicUrl,
            verifyUrl: `https://media.neeflow.com/${FILE_KEY}`,
            token: VERIFICATION_TOKEN,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
