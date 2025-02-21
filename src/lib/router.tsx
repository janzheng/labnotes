import * as React from 'react';
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createRoutePath,
} from '@tanstack/react-router';
import { ProjectWorkspace } from '@/components/ProjectWorkspace';
import { selectedProjectId } from '@/lib/stores';

// Root route
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
    </>
  ),
});

// Project route
const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$projectId',
  component: ProjectWorkspace,
  beforeLoad: ({ params }: { params: { projectId: string } }) => {
    selectedProjectId.set(params.projectId);
  },
});

// Index route (redirects to project if one is selected)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ProjectWorkspace,
  beforeLoad: () => {
    const currentProjectId = selectedProjectId.get();
    if (currentProjectId) {
      return {
        redirect: `/project/${currentProjectId}`,
      };
    }
    return {};
  },
});

// Create the router
const routeTree = rootRoute.addChildren([indexRoute, projectRoute]);

// Create and export the router instance
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Export the provider component
export function Provider({ children }: { children: React.ReactNode }) {
  return <RouterProvider router={router}>{children}</RouterProvider>;
}

// Declare types for type safety
declare module '@tanstack/router' {
  interface Register {
    router: typeof router;
  }
} 