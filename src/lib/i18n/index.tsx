'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import en from './en.json'
import vi from './vi.json'
import es from './es.json'

export type Locale = 'en' | 'vi' | 'es'

const translations: Record<Locale, typeof en> = { en, vi, es: es as unknown as typeof en }

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
    const { t } = useContext(I18nContext)
    return t
}
