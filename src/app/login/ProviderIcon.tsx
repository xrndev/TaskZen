import type { Provider } from './LoginForm'

const GITHUB_PATH = 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'

/** Logotipos de los proveedores. GitHub toma el color del texto para verse bien en tema claro y oscuro. */
export function ProviderIcon({ provider }: { provider: Provider }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true, className: 'shrink-0' } as const
  if (provider === 'github') {
    return (
      <svg {...common} fill="currentColor">
        <path d={GITHUB_PATH} />
      </svg>
    )
  }
  if (provider === 'google') {
    return (
      <svg {...common}>
        <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3a7.2 7.2 0 0 1-10.7-3.78H1.35v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.36 14.31a7.2 7.2 0 0 1 0-4.62v-3.1H1.35a12 12 0 0 0 0 10.82l4.01-3.1z" />
        <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.35 6.59l4.01 3.1C6.3 6.87 8.9 4.75 12 4.75z" />
      </svg>
    )
  }
  // Microsoft: cuatro cuadrados con los colores de la marca.
  return (
    <svg {...common}>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  )
}
