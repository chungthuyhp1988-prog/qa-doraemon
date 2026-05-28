import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../stores/toastStore';
import type { Database } from '../types/database';

type TableName = keyof Database['public']['Tables'];

interface UseCrudOptions {
  queryKeyToInvalidate?: any[];
  successMessages?: {
    create?: string;
    update?: string;
    delete?: string;
  };
}

export function useCrud(table: TableName, options: UseCrudOptions = {}) {
  const queryClient = useQueryClient();
  const invalidateKey = options.queryKeyToInvalidate || [table];
  
  const messages = {
    create: options.successMessages?.create || 'Thêm mới thành công!',
    update: options.successMessages?.update || 'Cập nhật thành công!',
    delete: options.successMessages?.delete || 'Xóa thành công!',
  };

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.create(table, payload),
    onSuccess: (res) => {
      if (res.error) {
        toast.error('Lỗi khi thêm mới', res.error);
      } else {
        toast.success(messages.create);
        queryClient.invalidateQueries({ queryKey: invalidateKey });
      }
    },
    onError: (err: any) => {
      toast.error('Lỗi khi thêm mới', err.message || 'Lỗi hệ thống');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => 
      api.update(table, id, payload),
    onSuccess: (res) => {
      if (res.error) {
        toast.error('Lỗi khi cập nhật', res.error);
      } else {
        toast.success(messages.update);
        queryClient.invalidateQueries({ queryKey: invalidateKey });
        // Also invalidate detail query key if it follows [table, id] pattern
        queryClient.invalidateQueries({ queryKey: [table, res.data?.id] });
      }
    },
    onError: (err: any) => {
      toast.error('Lỗi khi cập nhật', err.message || 'Lỗi hệ thống');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.remove(table, id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error('Lỗi khi xóa', res.error);
      } else {
        toast.success(messages.delete);
        queryClient.invalidateQueries({ queryKey: invalidateKey });
      }
    },
    onError: (err: any) => {
      toast.error('Lỗi khi xóa', err.message || 'Lỗi hệ thống');
    },
  });

  const softDeleteMutation = useMutation({
    mutationFn: (id: string) => api.softDelete(table, id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error('Lỗi khi xóa', res.error);
      } else {
        toast.success(messages.delete);
        queryClient.invalidateQueries({ queryKey: invalidateKey });
      }
    },
    onError: (err: any) => {
      toast.error('Lỗi khi xóa', err.message || 'Lỗi hệ thống');
    },
  });

  return {
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    deleteItem: deleteMutation.mutateAsync,
    softDeleteItem: softDeleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSoftDeleting: softDeleteMutation.isPending,
  };
}
