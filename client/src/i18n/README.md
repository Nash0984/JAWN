# Internationalization (i18n) System

## Overview

The Maryland Universal Benefits-Tax Navigator supports multiple languages to serve Maryland's diverse population, with initial support for English and Spanish.

## Technology Stack

- **i18next**: Core internationalization framework
- **react-i18next**: React bindings for i18next
- **i18next-browser-languagedetector**: Automatic language detection
- **i18next-http-backend**: Dynamic translation loading

## Features

- ✅ English and Spanish language support
- ✅ Automatic language detection based on browser settings
- ✅ Language preference persistence in localStorage
- ✅ Dynamic translation loading
- ✅ Namespaced translations for better organization
- ✅ Language switcher component with flag icons
- ✅ SEO-friendly language attributes

## File Structure

```
client/src/i18n/
├── config.ts                 # i18next configuration
└── README.md                 # This file

public/locales/
├── en/                       # English translations
│   ├── common.json          # Common UI elements
│   ├── benefits.json        # Benefit program terminology
│   ├── tax.json             # Tax preparation terms
│   ├── navigation.json      # Navigation labels
│   ├── forms.json           # Form field labels
│   ├── errors.json          # Error messages
│   └── demo.json            # Demo showcase content
└── es/                       # Spanish translations
    ├── common.json          # Elementos de UI comunes
    ├── benefits.json        # Terminología de programas de beneficios
    ├── tax.json             # Términos de preparación de impuestos
    ├── navigation.json      # Etiquetas de navegación
    ├── forms.json           # Etiquetas de campos de formulario
    ├── errors.json          # Mensajes de error
    └── demo.json            # Contenido de demostración
```

## Usage

### Basic Translation

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('app.title')}</h1>
      <p>{t('app.description')}</p>
    </div>
  );
}
```

### Translation with Namespace

```tsx
import { useTranslation } from 'react-i18next';

function BenefitsPage() {
  const { t } = useTranslation('benefits');
  
  return (
    <div>
      <h1>{t('eligibility.title')}</h1>
      <button>{t('application.start')}</button>
    </div>
  );
}
```

### Translation with Interpolation

```tsx
const { t } = useTranslation();

// Translation file: "welcome": "Welcome, {{name}}!"
<h1>{t('welcome', { name: user.name })}</h1>
```

### Pluralization

```tsx
const { t } = useTranslation();

// Translation file:
// "items_one": "{{count}} item"
// "items_other": "{{count}} items"
<p>{t('items', { count: itemCount })}</p>
```

### Language Switcher Component

```tsx
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

function Header() {
  return (
    <header>
      <LanguageSwitcher />
    </header>
  );
}
```

### Change Language Programmatically

```tsx
import { useTranslation } from 'react-i18next';

function SettingsPage() {
  const { i18n } = useTranslation();
  
  const changeToSpanish = () => {
    i18n.changeLanguage('es');
  };
  
  return <button onClick={changeToSpanish}>Cambiar a Español</button>;
}
```

## Translation Namespaces

### common.json
General UI elements, buttons, common actions, time/date labels

### benefits.json
- Benefit program names (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI)
- Eligibility terminology
- Household information fields
- Application statuses
- Document requirements
- Cross-enrollment messaging

### tax.json
- Tax preparation workflow
- VITA program information
- Tax form names (1040, 502, etc.)
- Tax document types (W-2, 1099, etc.)
- Tax credits (EITC, CTC, etc.)
- Filing statuses and refund information

### navigation.json
Navigation menu labels, page titles, breadcrumbs

### forms.json
Form field labels, validation messages, input placeholders

### errors.json
Error messages, validation errors, system messages

### demo.json
Demo showcase content, feature descriptions, sample data labels

## Adding New Translations

### 1. Add to English file (en/)

```json
{
  "new_feature": {
    "title": "New Feature",
    "description": "Description of the new feature",
    "action": "Take Action"
  }
}
```

### 2. Add corresponding Spanish translation (es/)

```json
{
  "new_feature": {
    "title": "Nueva Característica",
    "description": "Descripción de la nueva característica",
    "action": "Tomar Acción"
  }
}
```

### 3. Use in component

```tsx
const { t } = useTranslation();
<h1>{t('new_feature.title')}</h1>
```

## Language Detection Order

1. **localStorage**: Previously selected language
2. **navigator**: Browser language preference

User selections are automatically saved to localStorage for persistence.

## Best Practices

### 1. Use Semantic Keys
❌ Bad: `t('text1')`
✅ Good: `t('benefits.eligibility.check')`

### 2. Avoid Concatenation
❌ Bad: `t('hello') + ' ' + user.name`
✅ Good: `t('greeting', { name: user.name })`

### 3. Keep Translations Contextual
Group related translations together in namespaces

### 4. Use Consistent Casing
Maintain consistent casing for translation keys (camelCase recommended)

### 5. Provide Context in Comments
```json
{
  "submit": "Submit", // Used for form submission buttons
  "send": "Send"      // Used for message sending actions
}
```

## Testing Translations

### Manual Testing
1. Open application
2. Click language switcher
3. Select Spanish
4. Verify all text translates correctly
5. Check form validation messages
6. Test error scenarios

### Automated Testing
```tsx
import { renderWithI18n } from '@/test-utils';

test('renders Spanish translation', () => {
  const { getByText } = renderWithI18n(<MyComponent />, { lng: 'es' });
  expect(getByText('Hola')).toBeInTheDocument();
});
```

## Maryland-Specific Terminology

### Benefits Programs
- **SNAP**: Supplemental Nutrition Assistance Program (Programa de Asistencia Nutricional Suplementaria)
- **Medicaid**: Medicaid (Medical Assistance)
- **TANF/TCA**: Temporary Assistance for Needy Families (Asistencia Temporal para Familias Necesitadas)
- **OHEP**: Office of Home Energy Programs (Oficina de Programas de Energía del Hogar)
- **SSI**: Supplemental Security Income (Ingreso de Seguridad Suplementario)
- **VITA**: Volunteer Income Tax Assistance (Asistencia Voluntaria para la Preparación de Impuestos)

### Tax Forms
- **Form 1040**: Federal Income Tax Return
- **Form 502**: Maryland State Income Tax Return
- **EITC**: Earned Income Tax Credit (Crédito Tributario por Ingreso del Trabajo)
- **CTC**: Child Tax Credit (Crédito Tributario por Hijos)

## Accessibility

All language switchers include:
- Proper ARIA labels
- Keyboard navigation support
- Screen reader announcements for language changes
- Visual indicators (flag emojis) for language options

## Future Enhancements

- [ ] Additional language support (Chinese, French Creole, Korean)
- [ ] RTL language support (Arabic)
- [ ] Translation management dashboard
- [ ] Crowdsourced translation contributions
- [ ] Professional translation review workflow
- [ ] Translation memory and glossary
- [ ] Automated translation quality checks

## Contributing Translations

To contribute translations:

1. Fork the repository
2. Add/update translation files in `public/locales/`
3. Test thoroughly
4. Submit a pull request
5. Include context for any cultural adaptations

## Resources

- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Documentation](https://react.i18next.com/)
- [Maryland DHS Language Access Plan](https://dhs.maryland.gov/)
- [Federal Limited English Proficiency Guidelines](https://www.lep.gov/)
