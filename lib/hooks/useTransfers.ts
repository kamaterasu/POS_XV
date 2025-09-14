import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getTransfers,
  getTransferById,
  createTransfer,
  updateTransferStatus,
  deleteTransfer,
  type TransferStatus,
  type TransferAction
} from '../transfer/transferApi';
import { queryKeys } from './queryKeys';

// Query hooks
export function useTransfers(params?: {
  id?: string;
  status?: TransferStatus;
  src_store_id?: string;
  dst_store_id?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: queryKeys.transfers(params),
    queryFn: () => getTransfers(params),
  });
}

export function useTransfer(transferId: string) {
  return useQuery({
    queryKey: queryKeys.transfer(transferId),
    queryFn: () => getTransferById(transferId),
    enabled: !!transferId,
  });
}

// Mutation hooks
export function useCreateTransfer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (transferData: any) => createTransfer(transferData),
    onSuccess: () => {
      // Invalidate transfers queries
      queryClient.invalidateQueries({ queryKey: queryKeys.transfers() });
    },
  });
}

export function useUpdateTransferStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ transferId, action }: { transferId: string; action: TransferAction }) => 
      updateTransferStatus(transferId, action),
    onSuccess: (data, variables) => {
      // Invalidate transfers queries
      queryClient.invalidateQueries({ queryKey: queryKeys.transfers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.transfer(variables.transferId) });
    },
  });
}

export function useDeleteTransfer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (transferId: string) => deleteTransfer(transferId),
    onSuccess: (data, transferId) => {
      // Remove specific transfer from cache and invalidate lists
      queryClient.removeQueries({ queryKey: queryKeys.transfer(transferId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.transfers() });
    },
  });
}