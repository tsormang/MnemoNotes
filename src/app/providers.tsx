import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthProvider'
import { WorkspaceProvider } from '../features/auth/WorkspaceProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
