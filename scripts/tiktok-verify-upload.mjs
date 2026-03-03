#!/usr/bin/env node
// Upload TikTok domain verification file to R2
// Run from project root: node scripts/tiktok-verify-upload.mjs
//
// This script reads R2 credentials from the DB (using Prisma + encryption),
// then uploads the verification txt + HTML to the R2 bucket root.

const TOKEN = 'tiktok-developers-site-verification=WNcdzfqcL1l7ydxqgcJNKahevXq64mPT'
const TXT_KEY = 'tiktok-developers-site-verification.txt'
const HTML_KEY = 'index.html'

import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'

// --- Decrypt helper (mirrors src/lib/encryption.ts) ---
function decrypt(encryptedText) {
    const key = process.env.ENCRYPTION_KEY
    if (!key) throw new Error('ENCRYPTION_KEY env var not set')
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const keyBuf = Buffer.from(key, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv)
    decipher.setAuthTag(authTag)
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8')
}

// Load .env
const { config } = await import('dotenv')
config()

const prisma = new PrismaClient()

try {
    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'r2' } })
    if (!integration) throw new Error('R2 not configured in DB')

    const cfg = integration.config
    const accountId = cfg.r2AccountId.trim()
    const bucketName = cfg.r2BucketName.trim()
    const publicUrl = cfg.r2PublicUrl.trim().replace(/\/$/, '')
    const accessKeyId = decrypt(integration.apiKeyEncrypted)
    const secretAccessKey = decrypt(cfg.r2SecretAccessKey)

    console.log(`[R2] Account: ${accountId.slice(0, 8)}… | Bucket: ${bucketName}`)

    const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    })

    // 1. Upload txt file
    await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: TXT_KEY,
        Body: Buffer.from(TOKEN),
        ContentType: 'text/plain',
    }))
    console.log(`✅ Uploaded: ${publicUrl}/${TXT_KEY}`)

    // 2. Upload HTML with meta tag (for HTML-based verification)
    const html = `<!DOCTYPE html><html><head><meta name="tiktok-developers-site-verification" content="WNcdzfqcL1l7ydxqgcJNKahevXq64mPT" /></head><body>${TOKEN}</body></html>`
    await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: HTML_KEY,
        Body: Buffer.from(html),
        ContentType: 'text/html',
    }))
    console.log(`✅ Uploaded: ${publicUrl}/${HTML_KEY}`)

    console.log('\n🎉 Done. Now verify domain in TikTok Developer Portal.')
    console.log(`   Verification URL: ${publicUrl}/${TXT_KEY}`)

} finally {
    await prisma.$disconnect()
}
