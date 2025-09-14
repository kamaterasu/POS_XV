import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getUser,
  getUserIds,
  createUser,
  updateUser,
  deleteUser
} from '../user/userApi';
import { getAccessToken } from '../helper/getAccessToken';
import { queryKeys } from './queryKeys';

// Query hooks
export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async () => {
      const token = await getAccessToken();
      return getUser('', token); // Gets all users based on role
    },
  });
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: async () => {
      const token = await getAccessToken();
      return getUser(userId, token);
    },
    enabled: !!userId,
  });
}

export function useUserIds() {
  return useQuery({
    queryKey: queryKeys.userIds,
    queryFn: async () => {
      const token = await getAccessToken();
      return getUserIds(token);
    },
  });
}

// Mutation hooks
export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userData: {
      email: string;
      password: string;
      role: string;
      store_ids: string[];
      name: string;
    }) => {
      const token = await getAccessToken();
      return createUser(
        userData.email,
        userData.password,
        userData.role,
        userData.store_ids,
        userData.name,
        token
      );
    },
    onSuccess: () => {
      // Invalidate users queries
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.userIds });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userData: {
      user_id: string;
      role: string;
      store_ids: string[];
      name: string;
    }) => {
      const token = await getAccessToken();
      return updateUser(
        userData.user_id,
        userData.role,
        userData.store_ids,
        userData.name,
        token
      );
    },
    onSuccess: (data, variables) => {
      // Invalidate specific user and users list
      queryClient.invalidateQueries({ queryKey: queryKeys.user(variables.user_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      const token = await getAccessToken();
      return deleteUser(userId, token);
    },
    onSuccess: (data, userId) => {
      // Remove specific user from cache and invalidate lists
      queryClient.removeQueries({ queryKey: queryKeys.user(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.userIds });
    },
  });
}