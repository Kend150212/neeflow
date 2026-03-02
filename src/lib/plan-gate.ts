/**
 * Integration slugs registry.
 * Add slugs here when new integrations are built.
 */
export const INTEGRATION_SLUGS = [
    'external_db',
    'shopify',
    'wordpress',
    'hubspot',
    'salesforce',
    'google_sheets',
    'airtable',
    'zapier',
] as const

export type IntegrationSlug = typeof INTEGRATION_SLUGS[number]

/**
 * Check if a plan allows access to a specific integration.
 * Uses 'any' cast because allowedIntegrations is a new JSON field —
 * Prisma types update after migration runs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canUseIntegration(plan: any, slug: IntegrationSlug): boolean {
    const allowed = plan?.allowedIntegrations as string[] | null
    if (!allowed || !Array.isArray(allowed)) return false
    return allowed.includes(slug)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAllowedIntegrations(plan: any): string[] {
    const allowed = plan?.allowedIntegrations as string[] | null
    if (!allowed || !Array.isArray(allowed)) return []
    return allowed
}
