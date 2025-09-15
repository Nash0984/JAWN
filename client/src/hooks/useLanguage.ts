import { useState, useEffect } from 'react';

// Language context and translations
export const translations = {
  en: {
    // Navigation
    "nav.home": "Check Documents",
    "nav.search": "Search Policies", 
    "nav.help": "Get Help",
    "nav.title": "Maryland SNAP",
    "nav.subtitle": "Document Verification",
    
    // Home page
    "home.title": "Ask About Maryland SNAP Benefits",
    "home.subtitle": "Get answers from Maryland's official SNAP policy manual. Ask questions in plain English and get clear, helpful responses.",
    "home.search.placeholder": "Ask about Maryland SNAP eligibility...",
    "home.search.examples": "Common questions:",
    "home.documents.title": "Need to Check Documents?",
    "home.documents.subtitle": "Upload photos of paystubs, bank statements, or other documents to verify they meet SNAP requirements",
    "home.documents.toggle": "Check Document Upload",
    
    // Search interface
    "search.button": "Search",
    "search.loading": "Searching...",
    "search.error": "Something went wrong. We couldn't search right now. Please try again in a moment.",
    
    // Document verification
    "docs.upload": "Upload Document",
    "docs.verify": "Verify Document",
    "docs.loading": "Analyzing your document...",
    
    // System status
    "status.ready": "System ready",
    "status.processing": "Processing...",
    
    // Accessibility
    "accessibility.skip": "Skip to main content",
    "accessibility.menu": "Main menu",
    "accessibility.search": "Search Maryland SNAP policies"
  },
  es: {
    // Navigation
    "nav.home": "Verificar Documentos",
    "nav.search": "Buscar Políticas",
    "nav.help": "Obtener Ayuda",
    "nav.title": "SNAP de Maryland",
    "nav.subtitle": "Verificación de Documentos",
    
    // Home page
    "home.title": "Preguntas Sobre Beneficios SNAP de Maryland",
    "home.subtitle": "Obtenga respuestas del manual oficial de políticas SNAP de Maryland. Haga preguntas en inglés sencillo y obtenga respuestas claras y útiles.",
    "home.search.placeholder": "Preguntar sobre elegibilidad para SNAP de Maryland...",
    "home.search.examples": "Preguntas comunes:",
    "home.documents.title": "¿Necesita Verificar Documentos?",
    "home.documents.subtitle": "Suba fotos de talones de pago, estados bancarios u otros documentos para verificar que cumplan los requisitos de SNAP",
    "home.documents.toggle": "Verificar Carga de Documento",
    
    // Search interface
    "search.button": "Buscar",
    "search.loading": "Buscando...",
    "search.error": "Algo salió mal. No pudimos buscar ahora. Por favor intente de nuevo en un momento.",
    
    // Document verification
    "docs.upload": "Subir Documento",
    "docs.verify": "Verificar Documento",
    "docs.loading": "Analizando su documento...",
    
    // System status
    "status.ready": "Sistema listo",
    "status.processing": "Procesando...",
    
    // Accessibility
    "accessibility.skip": "Saltar al contenido principal",
    "accessibility.menu": "Menú principal",
    "accessibility.search": "Buscar políticas SNAP de Maryland"
  }
};

export type TranslationKey = keyof typeof translations.en;
export type LanguageCode = keyof typeof translations;

export function useLanguage() {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(() => {
    // Check localStorage first, then browser language, default to English
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language');
      if (saved && saved in translations) {
        return saved as LanguageCode;
      }
      
      const browserLang = navigator.language.split('-')[0];
      if (browserLang in translations) {
        return browserLang as LanguageCode;
      }
    }
    return 'en';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', currentLanguage);
    }
  }, [currentLanguage]);

  const translate = (key: TranslationKey): string => {
    return translations[currentLanguage]?.[key] || translations.en[key] || key;
  };

  const changeLanguage = (languageCode: string) => {
    if (languageCode in translations) {
      setCurrentLanguage(languageCode as LanguageCode);
    }
  };

  return {
    currentLanguage,
    changeLanguage,
    translate,
    t: translate // Shorter alias
  };
}