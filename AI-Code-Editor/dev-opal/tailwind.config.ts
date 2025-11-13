import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				
				// Material Design 3 Colors
				'md-primary': 'hsl(var(--md-primary))',
				'md-primary-container': 'hsl(var(--md-primary-container))',
				'md-on-primary': 'hsl(var(--md-on-primary))',
				'md-on-primary-container': 'hsl(var(--md-on-primary-container))',
				'md-secondary': 'hsl(var(--md-secondary))',
				'md-secondary-container': 'hsl(var(--md-secondary-container))',
				'md-on-secondary': 'hsl(var(--md-on-secondary))',
				'md-on-secondary-container': 'hsl(var(--md-on-secondary-container))',
				'md-tertiary': 'hsl(var(--md-tertiary))',
				'md-accent': 'hsl(var(--md-accent))',
				'md-accent-container': 'hsl(var(--md-accent-container))',
				'md-surface': 'hsl(var(--md-surface))',
				'md-surface-container': 'hsl(var(--md-surface-container))',
				'md-surface-container-high': 'hsl(var(--md-surface-container-high))',
				'md-surface-variant': 'hsl(var(--md-surface-variant))',
				'md-on-surface': 'hsl(var(--md-on-surface))',
				'md-on-surface-variant': 'hsl(var(--md-on-surface-variant))',
				'md-error': 'hsl(var(--md-error))',
				'md-warning': 'hsl(var(--md-warning))',
				'md-success': 'hsl(var(--md-success))',
				'md-info': 'hsl(var(--md-info))',
				
				// IDE Specific Colors
				'ide-panel': 'hsl(var(--ide-panel))',
				'ide-panel-border': 'hsl(var(--ide-panel-border))',
				'ide-editor': 'hsl(var(--ide-editor))',
				'ide-sidebar': 'hsl(var(--ide-sidebar))',
				'ide-terminal': 'hsl(var(--ide-terminal))',
				'ide-terminal-text': 'hsl(var(--ide-terminal-text))',
				
				// Legacy compatibility
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(4px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-in': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'glow': {
					'0%, 100%': { boxShadow: '0 0 5px hsl(var(--md-accent) / 0.5)' },
					'50%': { boxShadow: '0 0 20px hsl(var(--md-accent) / 0.8)' }
				},
				'pulse-soft': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.8' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'slide-in': 'slide-in 0.3s ease-out',
				'glow': 'glow 2s ease-in-out infinite',
				'pulse-soft': 'pulse-soft 2s ease-in-out infinite'
			},
			fontFamily: {
				'sans': ['Inter', 'system-ui', 'sans-serif'],
				'mono': ['JetBrains Mono', 'Consolas', 'monospace']
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
