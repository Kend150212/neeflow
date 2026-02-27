import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/channels/[id]/products/import
 * Bulk import products from CSV
 * 
 * CSV columns (header required):
 *   id, name, category, price, sale_price, description, features, images, tags, in_stock
 *   - features: pipe-separated "No paraben|SPF30"
 *   - images:   pipe-separated URLs
 *   - tags:     pipe-separated keywords
 *   - in_stock: true/false (default: true)
 * 
 * Uses upsert by (channelId + externalId) — safe to re-import without duplicates
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params

    const contentType = req.headers.get('content-type') || ''
    let csvText = ''

    if (contentType.includes('multipart/form-data')) {
        const form = await req.formData()
        const file = form.get('file') as File | null
        if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        csvText = await file.text()
    } else {
        // Plain text body (for testing)
        csvText = await req.text()
    }

    const lines = csvText.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return NextResponse.json({ error: 'CSV must have at least header + 1 row' }, { status: 400 })

    // Parse header
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
    const col = (name: string) => headers.indexOf(name)

    const results = { imported: 0, updated: 0, errors: [] as string[] }

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        try {
            const cols = parseCSVLine(line)
            const get = (name: string) => (col(name) >= 0 ? (cols[col(name)] || '').trim() : '')

            const name = get('name')
            if (!name) { results.errors.push(`Row ${i + 1}: missing name`); continue }

            const externalId = get('id') || null
            const price = get('price') ? parseFloat(get('price').replace(/[^\d.]/g, '')) : null
            const salePrice = get('sale_price') ? parseFloat(get('sale_price').replace(/[^\d.]/g, '')) : null
            const features = splitPipe(get('features'))
            const images = splitPipe(get('images'))

            // Auto-build tags from name + category + features if not provided
            let tags = splitPipe(get('tags'))
            if (tags.length === 0) {
                tags = [
                    ...name.toLowerCase().split(/\s+/),
                    ...(get('category') ? [get('category').toLowerCase()] : []),
                    ...features.map(f => f.toLowerCase()),
                ].filter(t => t.length > 1)
            }

            const inStock = get('in_stock').toLowerCase() !== 'false'
            const data = {
                channelId,
                productId: externalId,
                name,
                category: get('category') || null,
                price,
                salePrice,
                description: get('description') || null,
                features,
                images,
                tags,
                inStock,
                syncSource: 'csv' as const,
                externalId,
                syncedAt: new Date(),
            }

            if (externalId) {
                // Upsert by externalId — safe to re-import
                const existing = await prisma.productCatalog.findFirst({
                    where: { channelId, externalId },
                })
                if (existing) {
                    await prisma.productCatalog.update({ where: { id: existing.id }, data })
                    results.updated++
                } else {
                    await prisma.productCatalog.create({ data })
                    results.imported++
                }
            } else {
                await prisma.productCatalog.create({ data })
                results.imported++
            }
        } catch (err) {
            results.errors.push(`Row ${i + 1}: ${(err as Error).message}`)
        }
    }

    return NextResponse.json(results)
}

/** Parse a single CSV line handling quoted fields */
function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let field = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { field += '"'; i++ }
            else inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) {
            result.push(field); field = ''
        } else {
            field += ch
        }
    }
    result.push(field)
    return result
}

function splitPipe(s: string): string[] {
    if (!s) return []
    return s.split('|').map(x => x.trim()).filter(Boolean)
}
