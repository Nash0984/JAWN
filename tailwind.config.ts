import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "var(--radius-sm)",
      },
      colors: {
        /* Semantic System Colors */
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        
        /* Card System */
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          border: "hsl(var(--card-border))",
        },
        
        /* Popover & Overlay */
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        
        /* Tenant-Aware Brand Colors */
        "brand-primary": "hsl(var(--brand-primary))",
        "brand-secondary": "hsl(var(--brand-secondary))",
        "brand-accent": "hsl(var(--brand-accent))",
        
        /* Backward-compatible Maryland aliases (will be deprecated) */
        "maryland-red": "hsl(var(--brand-accent))", // Maps to brand accent
        "maryland-gold": "hsl(var(--brand-secondary))", // Maps to brand secondary  
        "maryland-black": "hsl(var(--foreground))",
        "maryland-white": "hsl(var(--background))",
        "md-red": "hsl(var(--brand-accent))",
        "md-gold": "hsl(var(--brand-secondary))",
        "md-black": "hsl(var(--foreground))",
        
        /* Primary Action Colors */
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        
        /* Secondary Action Colors */
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          hover: "hsl(var(--secondary-hover))",
        },
        
        /* Muted & Subtle */
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
          hover: "hsl(var(--muted-hover))",
        },
        
        /* Accent */
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          subtle: "hsl(var(--accent-subtle))",
        },
        
        /* Semantic State Colors */
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          subtle: "hsl(var(--success-subtle))",
        },
        
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          subtle: "hsl(var(--warning-subtle))",
        },
        
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          subtle: "hsl(var(--destructive-subtle))",
        },
        
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          subtle: "hsl(var(--info-subtle))",
        },
        
        /* Borders & Inputs */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        
        /* Icon Backgrounds */
        "icon-bg": {
          DEFAULT: "hsl(var(--icon-background))",
          hover: "hsl(var(--icon-background-hover))",
        },
        
        /* Chart Colors */
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        
        /* Sidebar */
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Montserrat", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "SF Mono", "Monaco", "monospace"],
      },
      spacing: {
        "spacing": "var(--spacing)",
        "spacing-sm": "var(--spacing-sm)",
        "spacing-md": "var(--spacing-md)",
        "spacing-lg": "var(--spacing-lg)",
        "spacing-xl": "var(--spacing-xl)",
      },
      boxShadow: {
        "xs": "var(--shadow-xs)",
        "sm": "var(--shadow-sm)",
        "DEFAULT": "var(--shadow)",
        "md": "var(--shadow-md)",
        "lg": "var(--shadow-lg)",
        "xl": "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-secondary": "var(--gradient-secondary)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        slideUp: {
          from: {
            opacity: "0",
            transform: "translateY(10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        slideDown: {
          from: {
            opacity: "0",
            transform: "translateY(-10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        fadeIn: {
          from: {
            opacity: "0",
          },
          to: {
            opacity: "1",
          },
        },
        pulse: {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.5",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "pulse": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"), 
    require("@tailwindcss/typography"),
    
    // Custom utilities for government accessibility and modern design
    function({ addUtilities, addComponents }: { addUtilities: Function, addComponents: Function }) {
      // Accessibility utilities
      const accessibilityUtilities = {
        '.gov-focus': {
          '&:focus-visible': {
            outline: '3px solid hsl(var(--ring))',
            'outline-offset': '2px',
            'border-radius': '2px',
          },
        },
        '.gov-text-contrast': {
          color: 'hsl(var(--foreground))',
          'background-color': 'hsl(var(--background))',
        },
        '.touch-target': {
          'min-height': '44px',
          'min-width': '44px',
        },
        '.touch-target-lg': {
          'min-height': '56px',
          'min-width': '56px',
        },
      };
      
      // Modern component utilities
      const modernUtilities = {
        '.card-elevated': {
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--card-border))',
          'border-radius': 'var(--radius)',
          'box-shadow': 'var(--shadow-sm)',
          transition: 'all 0.2s ease',
          '&:hover': {
            'box-shadow': 'var(--shadow-md)',
            transform: 'translateY(-1px)',
          },
        },
        '.glass-effect': {
          background: 'hsl(var(--background) / 0.8)',
          'backdrop-filter': 'blur(10px)',
          border: '1px solid hsl(var(--border) / 0.5)',
        },
        '.gradient-header': {
          background: 'var(--gradient-primary)',
          color: 'white',
        },
        '.processing-animation': {
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        '.slide-up': {
          animation: 'slideUp 0.3s ease-out',
        },
        '.slide-down': {
          animation: 'slideDown 0.3s ease-out',
        },
        '.fade-in': {
          animation: 'fadeIn 0.3s ease-out',
        },
        '.upload-zone': {
          border: '2px dashed hsl(var(--border))',
          'border-radius': 'var(--radius)',
          transition: 'all 0.2s ease-in-out',
          '&:hover, &.dragover': {
            'border-color': 'hsl(var(--primary))',
            'background-color': 'hsl(var(--primary) / 0.05)',
          },
        },
      };
      
      // Button component classes
      const buttonComponents = {
        '.btn': {
          display: 'inline-flex',
          'align-items': 'center',
          'justify-content': 'center',
          'border-radius': 'var(--radius)',
          'font-weight': '500',
          'font-size': '0.875rem',
          'line-height': '1.25rem',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          border: 'none',
          outline: 'none',
          padding: '0.625rem 1rem',
        },
        '.btn-sm': {
          padding: '0.5rem 0.875rem',
          'font-size': '0.8125rem',
        },
        '.btn-lg': {
          padding: '0.75rem 1.25rem',
          'font-size': '1rem',
        },
      };
      
      addUtilities(accessibilityUtilities);
      addUtilities(modernUtilities);
      addComponents(buttonComponents);
    },
  ],
} satisfies Config;
