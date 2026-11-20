import { useEffect, useState, type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listJobsResponseSchema,
  jobResponseSchema,
  customerOptionsSchema,
  branchOptionsSchema,
  equipmentOptionsSchema,
  type CreateJob,
  type ListJobsQuery,
} from '@chillops/shared/jobs';
import { useAuth } from '../auth/AuthContext';
import { JobsApiError, jobsRequest } from './api';

function UserQueries({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [client] = useState(() => {
    const onError = (error: Error) => {
      if (error instanceof JobsApiError && error.status === 401)
        auth.expireSession();
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
export function JobsQueryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <UserQueries key={`${user?.id ?? 'guest'}:${user?.role ?? ''}`}>
      {children}
    </UserQueries>
  );
}
export function useJobs(query: ListJobsQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined)
      params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  return useQuery({
    queryKey: ['jobs', query],
    queryFn: ({ signal }) =>
      jobsRequest(`/api/jobs?${params}`, listJobsResponseSchema, { signal }),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
}
export function useJob(id: string) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: ({ signal }) =>
      jobsRequest(`/api/jobs/${encodeURIComponent(id)}`, jobResponseSchema, {
        signal,
      }),
  });
}
export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: ({ signal }) =>
      jobsRequest('/api/lookups/customers', customerOptionsSchema, { signal }),
  });
}
export function useBranches(id: string) {
  return useQuery({
    queryKey: ['branches', id],
    enabled: !!id,
    queryFn: ({ signal }) =>
      jobsRequest(
        `/api/lookups/branches?customer_id=${encodeURIComponent(id)}`,
        branchOptionsSchema,
        { signal },
      ),
  });
}
export function useEquipment(id: string) {
  return useQuery({
    queryKey: ['equipment', id],
    enabled: !!id,
    queryFn: ({ signal }) =>
      jobsRequest(
        `/api/lookups/equipment?branch_id=${encodeURIComponent(id)}`,
        equipmentOptionsSchema,
        { signal },
      ),
  });
}
export function useCreateJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateJob) =>
      jobsRequest('/api/jobs', jobResponseSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (result) => {
      client.setQueryData(['job', result.job.id], result);
      void client.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
