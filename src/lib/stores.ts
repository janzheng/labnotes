import { atom } from 'nanostores';
import { nanoid } from 'nanoid';
import { createStorage } from 'unstorage';
import localStorageDriver from 'unstorage/drivers/localstorage';
import type { ComponentType, ProjectsState, Project, ComponentConfig } from './types';
import { initialState } from './initialState';

// Initialize storage with proper localStorage configuration
const storage = createStorage({
  driver: localStorageDriver({
    base: 'projects-db',
    localStorage: typeof window !== 'undefined' ? window.localStorage : undefined
  })
});

// State atoms
export const isLoading = atom(true);
export const error = atom<string | null>(null);
export const isInitialized = atom(false);
export const isSidebarOpen = atom(true);
export const selectedProjectId = atom<string | null>(null);
export const projectsStore = atom<ProjectsState>(initialState);

// URL selection logic
export const selectProjectFromUrl = () => {
  if (typeof window === 'undefined') return;
  
  const path = window.location.pathname;
  const matches = path.match(/\/project\/([^/]+)/);
  
  if (matches && matches[1]) {
    const projectId = matches[1];
    const state = projectsStore.get();
    
    // Only select if project exists
    if (state.items[projectId]) {
      selectedProjectId.set(projectId);
    }
  }
};

// Store initialization
async function initializeStore() {
  if (typeof window === 'undefined') {
    isInitialized.set(true);
    isLoading.set(false);
    return;
  }

  try {
    isLoading.set(true);
    error.set(null);
    const storedState = await storage.getItem('projectsState');
    if (storedState) {
      projectsStore.set(storedState as ProjectsState);
    }
    isInitialized.set(true);
    // Add URL-based selection after state is loaded
    selectProjectFromUrl();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load stored state';
    error.set(errorMessage);
    console.error('Failed to load stored state:', err);
  } finally {
    isLoading.set(false);
  }
}

// Store persistence
projectsStore.listen(async (state) => {
  try {
    error.set(null);
    await storage.setItem('projectsState', state);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to persist state';
    error.set(errorMessage);
    console.error('Failed to persist state:', err);
  }
});

// Project operations
export const addProject = async (name: string, parentId: string | null = null) => {
  try {
    isLoading.set(true);
    error.set(null);
    const id = nanoid();
    const project: Project = {
      id,
      name,
      parentId,
      type: 'project'
    };
    
    const currentState = projectsStore.get();
    const newState = {
      items: { ...currentState.items, [id]: project },
      rootIds: parentId === null ? [...currentState.rootIds, id] : currentState.rootIds
    };

    if (parentId && currentState.items[parentId]?.type === 'folder') {
      newState.items[parentId] = {
        ...currentState.items[parentId],
        children: [...(currentState.items[parentId].children || []), id]
      };
    }

    await projectsStore.set(newState);
    
    // Navigate to the new project URL
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/project/${id}`);
      selectedProjectId.set(id);
    }
    
    return id;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to add project';
    error.set(errorMessage);
    throw err;
  } finally {
    isLoading.set(false);
  }
};

export const addFolder = (name: string, parentId: string | null = null) => {
  const id = nanoid();
  const folder: Project = {
    id,
    name,
    parentId,
    type: 'folder',
    children: []
  };
  
  const currentState = projectsStore.get();
  const newState = {
    items: { ...currentState.items, [id]: folder },
    rootIds: parentId === null ? [...currentState.rootIds, id] : currentState.rootIds
  };

  if (parentId && currentState.items[parentId]?.type === 'folder') {
    newState.items[parentId] = {
      ...currentState.items[parentId],
      children: [...(currentState.items[parentId].children || []), id]
    };
  }

  projectsStore.set(newState);
  return id;
};

export const moveProject = (projectId: string, newParentId: string | null, targetIndex?: number) => {
  const currentState = projectsStore.get();
  console.log('Move Project - Initial State:', JSON.stringify(currentState, null, 2));
  console.log('Moving project:', projectId, 'to parent:', newParentId, 'at index:', targetIndex);
  
  const project = currentState.items[projectId];
  if (!project) {
    console.log('Project not found:', projectId);
    return;
  }

  // Create new state to avoid mutations
  const newState = {
    items: { ...currentState.items },
    rootIds: [...currentState.rootIds]
  };

  // Remove from old parent
  if (project.parentId) {
    const oldParent = newState.items[project.parentId];
    if (oldParent && oldParent.children) {
      console.log('Removing from old parent:', project.parentId);
      newState.items[project.parentId] = {
        ...oldParent,
        children: oldParent.children.filter(id => id !== projectId)
      };
    }
  } else {
    console.log('Removing from root');
    newState.rootIds = newState.rootIds.filter(id => id !== projectId);
  }

  // Add to new parent
  if (newParentId) {
    const newParent = newState.items[newParentId];
    if (newParent && newParent.type === 'folder') {
      console.log('Adding to folder:', newParentId);
      const newChildren = [...(newParent.children || [])];
      
      if (targetIndex !== undefined) {
        newChildren.splice(targetIndex, 0, projectId);
      } else {
        newChildren.push(projectId);
      }

      newState.items[newParentId] = {
        ...newParent,
        children: newChildren
      };
    }
  } else {
    console.log('Adding to root at index:', targetIndex);
    if (targetIndex !== undefined) {
      newState.rootIds.splice(targetIndex, 0, projectId);
    } else {
      newState.rootIds.push(projectId);
    }
  }

  // Update project's parentId
  newState.items[projectId] = {
    ...project,
    parentId: newParentId
  };

  console.log('Move Project - Final State:', JSON.stringify(newState, null, 2));
  projectsStore.set(newState);
};

export const deleteProject = (projectId: string) => {
  const currentState = projectsStore.get();
  const project = currentState.items[projectId];
  
  if (!project) return;

  // If it's a folder, recursively delete all children
  if (project.type === 'folder' && project.children) {
    project.children.forEach(childId => deleteProject(childId));
  }

  // Remove from parent
  if (project.parentId) {
    const parent = currentState.items[project.parentId];
    if (parent && parent.children) {
      currentState.items[project.parentId] = {
        ...parent,
        children: parent.children.filter(id => id !== projectId)
      };
    }
  }

  // Remove from rootIds if it's there
  currentState.rootIds = currentState.rootIds.filter(id => id !== projectId);

  // Remove the project itself
  const { [projectId]: removed, ...remainingItems } = currentState.items;
  
  projectsStore.set({
    items: remainingItems,
    rootIds: currentState.rootIds
  });
};

// Component operations
export const assignComponentToProject = (projectId: string, componentType: ComponentType, initialData: Record<string, any> = {}) => {
  const currentState = projectsStore.get();
  const project = currentState.items[projectId];
  
  if (!project || project.type !== 'project') return;

  const newComponent: ComponentConfig = {
    type: componentType,
    data: initialData
  };

  const updatedProject = {
    ...project,
    components: [...(project.components || []), newComponent]
  };

  projectsStore.set({
    ...currentState,
    items: {
      ...currentState.items,
      [projectId]: updatedProject
    }
  });
};

export const removeComponentFromProject = (projectId: string, componentIndex: number) => {
  const currentState = projectsStore.get();
  const project = currentState.items[projectId];
  
  if (!project || project.type !== 'project' || !project.components) return;

  const updatedComponents = [...project.components];
  updatedComponents.splice(componentIndex, 1);

  const updatedProject = {
    ...project,
    components: updatedComponents
  };

  projectsStore.set({
    ...currentState,
    items: {
      ...currentState.items,
      [projectId]: updatedProject
    }
  });
};

// Initialize store in browser
if (typeof window !== 'undefined') {
  initializeStore();
}

// Re-export types
export * from './types';

export default projectsStore; 