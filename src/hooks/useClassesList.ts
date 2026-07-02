import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../stores/appStore';
import { queryKeys } from '../lib/queryKeys';
import { api } from '../lib/api';
import { sortClasses } from '../lib/classUtils';

/**
 * Custom hook to fetch and sort classes list by academic year.
 * Provides central caching and automatic sorting.
 */
export function useClassesList() {
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);

  const query = useQuery({
    queryKey: queryKeys.classes.list(selectedAcademicYearId || undefined),
    queryFn: async () => {
      if (!selectedAcademicYearId) {
        return [];
      }
      const response = await api.getAll<any>('classes', { page: 1, pageSize: 100 }, {
        filters: { academic_year_id: selectedAcademicYearId }
      });
      const data = response.data?.data || [];
      return sortClasses(data);
    },
    enabled: !!selectedAcademicYearId,
  });

  return {
    classesList: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    selectedAcademicYearId
  };
}
