'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import en from './en.json'
import vi from './vi.json'
import es from './es.json'
// Chunk files — KB content strings, add more chunks here as needed
import enKb from './en.kb.json'
import viKb from './vi.kb.json'
import esKb from './es.kb.json'

export type Locale = 'en' | 'vi' | 'es'

// Deep merge utility
function deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Record<string, unknown>[]): T {
    for (const source of sources) {
        for (const key in source) {
            const sv = source[key]
            const tv = (target as Record<string, unknown>)[key]
            if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object') {
                deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>)
            } else {
                (target as Record<string, unknown>)[key] = sv
            }
        }
    }
    return target
}

// Build merged translation objects per locale
const translations: Record<Locale, typeof en> = {
    en: deepMerge({ ...en } as typeof en, enKb as Record<string, unknown>),
    vi: deepMerge({ ...vi } as typeof en, viKb as Record<string, unknown>),
    es: deepMerge({ ...es } as typeof en, esKb as Record<string, unknown>),
}

interface I18nContextType {
    locale: Locale
    setLocale: (locale: Locale) => void
    t: (key: string) => string
}

const I18nContext = createContext<I18nContextType>({
    locale: 'en',
    setLocale: () => { },
    t: (key: string) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en')

    useEffect(() => {
        const saved = localStorage.getItem('locale') as Locale
        if (saved && translations[saved]) {
            setLocaleState(saved)
        }
    }, [])

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale)
        localStorage.setItem('locale', newLocale)
    }, [])

    const t = useCallback(
        (key: string): string => {
            const keys = key.split('.')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let value: any = translations[locale]
            for (const k of keys) {
                value = value?.[k]
                if (value === undefined) return key
            }
            return typeof value === 'string' ? value : key
        },
        [locale]
    )

    return (
        <I18nContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </I18nContext.Provider>
    )
}

export function useI18n() {
    return useContext(I18nContext)
}

export function useTranslation() {
    const { t } = useI18n()
    return t as (key: Parameters<typeof t>[0]) => string
}
