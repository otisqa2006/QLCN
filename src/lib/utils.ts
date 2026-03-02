import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format a number as currency with a " đ" suffix.
 */
export function formatCurrency(amount: number | string): string {
    const num = Number(amount)
    if (isNaN(num)) return amount?.toString() || '0 đ'
    return `${num.toLocaleString('vi-VN')} đ`
}

/**
 * Format a number consistently, typically used when the suffix is handled by the UI.
 */
export function formatNumber(amount: number | string): string {
    const num = Number(amount)
    if (isNaN(num)) return amount?.toString() || '0'
    return num.toLocaleString('vi-VN')
}
