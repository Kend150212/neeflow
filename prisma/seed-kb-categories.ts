/**
 * Seed script: ArticleCategory rows for NeeFlow Knowledge Base
 * Run ONCE after seed-kb-articles.ts:
 *   npx tsx prisma/seed-kb-categories.ts
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter }) as any

const categories = [
    {
        slug: 'getting_started',
        name: 'Getting Started',
        icon: 'rocket',
        color: 'blue',
        sortOrder: 1,
        isActive: true,
    },
    {
        slug: 'ai',
        name: 'AI & Automation',
        icon: 'sparkles',
        color: 'purple',
        sortOrder: 2,
        isActive: true,
    },
    {
        slug: 'integrations',
        name: 'Integrations & Scheduling',
        icon: 'plug',
        color: 'green',
        sortOrder: 3,
        isActive: true,
    },
    {
        slug: 'billing',
        name: 'Billing & Plans',
        icon: 'credit-card',
        color: 'yellow',
        sortOrder: 4,
        isActive: true,
    },
    {
        slug: 'troubleshooting',
        name: 'Troubleshooting',
        icon: 'wrench',
        color: 'red',
        sortOrder: 5,
        isActive: true,
    },
    {
        slug: 'security',
        name: 'Security & Privacy',
        icon: 'shield',
        color: 'indigo',
        sortOrder: 6,
        isActive: true,
    },
]

async function main() {
    let created = 0, updated = 0

    for (const cat of categories) {
        const existing = await prisma.articleCategory.findFirst({ where: { slug: cat.slug } })
        if (existing) {
            await prisma.articleCategory.update({ where: { id: existing.id }, data: cat })
            console.log(`🔄 Updated: ${cat.name}`)
            updated++
        } else {
            await prisma.articleCategory.create({ data: cat })
            console.log(`✅ Created: ${cat.name}`)
            created++
        }
    }

    console.log(`\n🎉 Done! Created: ${created} | Updated: ${updated}`)
}

main()
    .then(async () => { await prisma.$disconnect(); await pool.end() })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); await pool.end(); process.exit(1) })
