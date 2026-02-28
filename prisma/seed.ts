import { PrismaClient, UserRole, IntegrationCategory, IntegrationStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { seedEmailTemplates } from './seed-email-templates'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12)

    const admin = await prisma.user.upsert({
        where: { email: 'admin@neeflow.com' },
        update: {},
        create: {
            email: 'admin@neeflow.com',
            name: 'Ken Dao',
            passwordHash: adminPassword,
            role: UserRole.ADMIN,
            isActive: true,
        },
    })

    console.log('✅ Admin user created:', admin.email)

    // Create admin preference
    await prisma.userPreference.upsert({
        where: { userId: admin.id },
        update: {},
        create: {
            userId: admin.id,
            theme: 'dark',
            locale: 'vi',
        },
    })

    // Create default API integrations
    const integrations = [
        {
            category: IntegrationCategory.SOCIAL,
            provider: 'vbout',
            name: 'Vbout',
            isActive: true,
            isDefault: true,
            status: IntegrationStatus.ACTIVE,
            rateLimitPerSec: 10,
            baseUrl: 'https://api.vbout.com/1',
        },
        {
            category: IntegrationCategory.SOCIAL,
            provider: 'youtube',
            name: 'YouTube (Google)',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.SOCIAL,
            provider: 'tiktok',
            name: 'TikTok',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.SOCIAL,
            provider: 'facebook',
            name: 'Facebook',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.SOCIAL,
            provider: 'instagram',
            name: 'Instagram',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.SOCIAL,
            provider: 'linkedin',
            name: 'LinkedIn',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.SOCIAL,
            provider: 'x',
            name: 'X (Twitter)',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.SOCIAL,
            provider: 'pinterest',
            name: 'Pinterest',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.SOCIAL,
            provider: 'threads',
            name: 'Threads',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
            baseUrl: 'https://graph.threads.net/v1.0',
        },
        {
            category: IntegrationCategory.SOCIAL,
            provider: 'gbp',
            name: 'Google Business Profile',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
            baseUrl: 'https://mybusiness.googleapis.com/v4',
        },
        {
            category: IntegrationCategory.AI,
            provider: 'openai',
            name: 'OpenAI',
            isActive: false,
            isDefault: true,
            status: IntegrationStatus.INACTIVE,
            baseUrl: 'https://api.openai.com/v1',
        },
        {
            category: IntegrationCategory.AI,
            provider: 'gemini',
            name: 'Google Gemini',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        },
        {
            category: IntegrationCategory.AI,
            provider: 'runware',
            name: 'Runware',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
            baseUrl: 'https://api.runware.ai/v1',
        },
        {
            category: IntegrationCategory.AI,
            provider: 'openrouter',
            name: 'OpenRouter',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
            baseUrl: 'https://openrouter.ai/api/v1',
        },
        {
            category: IntegrationCategory.AI,
            provider: 'synthetic',
            name: 'Synthetic',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
            baseUrl: 'https://api.synthetic.new/openai/v1',
        },
        {
            category: IntegrationCategory.DESIGN,
            provider: 'robolly',
            name: 'Robolly',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
            baseUrl: 'https://api.robolly.com',
        },
        {
            category: IntegrationCategory.STORAGE,
            provider: 'gdrive',
            name: 'Google Drive',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.STORAGE,
            provider: 'r2',
            name: 'Cloudflare R2',
            isActive: false,
            isDefault: true,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.EMAIL,
            provider: 'smtp',
            name: 'SMTP (Nodemailer)',
            isActive: false,
            isDefault: true,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.AUTH,
            provider: 'recaptcha',
            name: 'Google reCAPTCHA v3',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
        },
        {
            category: IntegrationCategory.WEBHOOK,
            provider: 'zalo',
            name: 'Zalo OA',
            isActive: false,
            isDefault: false,
            status: IntegrationStatus.INACTIVE,
        },
    ]

    for (const integration of integrations) {
        await prisma.apiIntegration.upsert({
            where: {
                category_provider: {
                    category: integration.category,
                    provider: integration.provider,
                },
            },
            update: {},
            create: integration,
        })
    }

    console.log('✅ API integrations seeded:', integrations.length)

    await seedEmailTemplates()

    console.log('')
    console.log('🎉 Database seeded successfully!')
    console.log('   Login: admin@neeflow.com / admin123')
}

main()
    .then(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        await pool.end()
        process.exit(1)
    })
