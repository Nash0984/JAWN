import { create } from 'zustand';

interface TranslationFilters {
  namespace: string;
  targetLocaleId: string;
  status: string;
  assignedTo: string;
  search: string;
  page: number;
  limit: number;
}

interface TranslationFiltersStore {
  filters: TranslationFilters;
  setNamespace: (namespace: string) => void;
  setLocale: (localeId: string) => void;
  setStatus: (status: string) => void;
  setAssignedTo: (userId: string) => void;
  setSearch: (query: string) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
}

export const useTranslationFilters = create<TranslationFiltersStore>((set) => ({
  filters: {
    namespace: '',
    targetLocaleId: '',
    status: '',
    assignedTo: '',
    search: '',
    page: 1,
    limit: 20,
  },
  setNamespace: (namespace) => set((state) => ({ filters: { ...state.filters, namespace, page: 1 } })),
  setLocale: (targetLocaleId) => set((state) => ({ filters: { ...state.filters, targetLocaleId, page: 1 } })),
  setStatus: (status) => set((state) => ({ filters: { ...state.filters, status, page: 1 } })),
  setAssignedTo: (assignedTo) => set((state) => ({ filters: { ...state.filters, assignedTo, page: 1 } })),
  setSearch: (search) => set((state) => ({ filters: { ...state.filters, search, page: 1 } })),
  setPage: (page) => set((state) => ({ filters: { ...state.filters, page } })),
  resetFilters: () => set({
    filters: { namespace: '', targetLocaleId: '', status: '', assignedTo: '', search: '', page: 1, limit: 20 }
  }),
}));
