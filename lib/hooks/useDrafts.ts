import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  loadDraftsFromBackend,
  saveDraftToBackend,
  deleteDraftFromBackend,
  type Draft,
  type DraftData
} from '../draft/draftApi';
import { queryKeys } from './queryKeys';

// Query hooks
export function useDrafts() {
  return useQuery({
    queryKey: queryKeys.drafts,
    queryFn: loadDraftsFromBackend,
  });
}

// Mutation hooks
export function useSaveDraft() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (draftData: DraftData) => saveDraftToBackend(draftData),
    onSuccess: () => {
      // Invalidate drafts queries
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts });
    },
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (draftId: string) => deleteDraftFromBackend(draftId),
    onSuccess: () => {
      // Invalidate drafts queries
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts });
    },
  });
}