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

// Initialize UI state storage
const uiStorage = createStorage({
  driver: localStorageDriver({
    base: 'ui-state',
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

// Section visibility states - with default values that will be overridden on init
export const isProjectsSectionCollapsed = atom(false);
export const isHistorySectionCollapsed = atom(false);

// Folder expansion state
export const expandedFolders = atom<Record<string, boolean>>({});

// BasicTech feature toggle
export const isBasicTechEnabled = atom(true); // This is an OVERRIDE — Set default to false to disable by default

// UI style preferences
export const cursorPointerClass = 'cursor-pointer'; // CSS class for clickable elements

// Delete confirmation modal state
export const deleteModalState = atom<{
  isOpen: boolean;
  projectId: string | null;
  projectName: string;
  onConfirm: () => void;
}>({
  isOpen: false,
  projectId: null,
  projectName: '',
  onConfirm: () => {}
});

// Project selection
export const selectProject = (projectId: string) => {
  if (!projectId) return;
  
  const state = projectsStore.get();
  
  // Only select if project exists
  if (state.items[projectId]) {
    // First clear the current selection to trigger proper re-renders
    selectedProjectId.set(null);
    
    // Use setTimeout to ensure the null value is processed first
    setTimeout(() => {
      selectedProjectId.set(projectId);
      
      // Update URL if needed
      if (typeof window !== 'undefined') {
        const url = `/project/${projectId}`;
        if (window.location.pathname !== url) {
          window.history.pushState({}, '', url);
        }
      }
    }, 0);
  }
};

// URL selection logic
export const selectProjectFromUrl = () => {
  if (typeof window === 'undefined') return;
  
  const path = window.location.pathname;
  const matches = path.match(/\/project\/([^/]+)/);
  
  if (matches && matches[1]) {
    const projectId = matches[1];
    selectProject(projectId);
  }
};

// Initialize UI state
async function initializeUIState() {
  if (typeof window === 'undefined') return;

  try {
    // Load section collapse states
    const projectsSectionState = await uiStorage.getItem('projectsSectionCollapsed');
    if (projectsSectionState !== null) {
      isProjectsSectionCollapsed.set(projectsSectionState as boolean);
    }
    
    const historySectionState = await uiStorage.getItem('historySectionCollapsed');
    if (historySectionState !== null) {
      isHistorySectionCollapsed.set(historySectionState as boolean);
    }
    
    // Load folder expansion states
    const folderStates = await uiStorage.getItem('expandedFolders');
    if (folderStates) {
      expandedFolders.set(folderStates as Record<string, boolean>);
    }
  } catch (err) {
    console.error('Failed to load UI state:', err);
  }
}

// Save section collapse states when they change
isProjectsSectionCollapsed.listen(async (collapsed) => {
  if (typeof window === 'undefined') return;
  try {
    await uiStorage.setItem('projectsSectionCollapsed', collapsed);
  } catch (err) {
    console.error('Failed to save projects section state:', err);
  }
});

isHistorySectionCollapsed.listen(async (collapsed) => {
  if (typeof window === 'undefined') return;
  try {
    await uiStorage.setItem('historySectionCollapsed', collapsed);
  } catch (err) {
    console.error('Failed to save history section state:', err);
  }
});

// Save folder expansion states when they change
expandedFolders.listen(async (states) => {
  if (typeof window === 'undefined') return;
  try {
    await uiStorage.setItem('expandedFolders', states);
  } catch (err) {
    console.error('Failed to save folder states:', err);
  }
});

// Helper function to toggle folder expansion
export const toggleFolderExpanded = (folderId: string) => {
  const currentStates = expandedFolders.get();
  const isCurrentlyExpanded = currentStates[folderId] ?? false; // Default to false if not set
  
  expandedFolders.set({
    ...currentStates,
    [folderId]: !isCurrentlyExpanded
  });
};

// Check if a folder is expanded
export const isFolderExpanded = (folderId: string) => {
  return expandedFolders.get()[folderId] ?? false; // Default to false if not set
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
    
    // Initialize UI state after project state is loaded
    await initializeUIState();
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
export const addProject = async (name: string, parentId: string | null = null, insertIndex?: number) => {
  try {
    isLoading.set(true);
    error.set(null);
    const id = nanoid();
    const project: Project = {
      id,
      name,
      parentId,
      type: 'project',
      lastModified: Date.now()
    };
    
    const currentState = projectsStore.get();
    const newState = {
      items: { ...currentState.items, [id]: project },
      rootIds: [...currentState.rootIds]
    };

    // Handle insertion at specific index
    if (parentId === null) {
      // Add to root at specific index
      if (insertIndex !== undefined) {
        newState.rootIds.splice(insertIndex, 0, id);
      } else {
        newState.rootIds.push(id);
      }
    } else if (currentState.items[parentId]?.type === 'folder') {
      // Add to folder at specific index
      const parentFolder = currentState.items[parentId];
      const children = [...(parentFolder.children || [])];
      
      if (insertIndex !== undefined) {
        children.splice(insertIndex, 0, id);
      } else {
        children.push(id);
      }
      
      newState.items[parentId] = {
        ...parentFolder,
        children
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

// Show delete confirmation modal
export const showDeleteConfirmation = (projectId: string) => {
  const currentState = projectsStore.get();
  const project = currentState.items[projectId];
  
  if (!project) return;
  
  deleteModalState.set({
    isOpen: true,
    projectId,
    projectName: project.name,
    onConfirm: () => {
      // Actual delete operation
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
      
      // Close modal after deletion
      closeDeleteModal();
    }
  });
};

// Close delete confirmation modal
export const closeDeleteModal = () => {
  deleteModalState.set({
    isOpen: false,
    projectId: null,
    projectName: '',
    onConfirm: () => {}
  });
};

// Get projects sorted by last modified date (newest first)
export const getProjectsByLastModified = () => {
  const state = projectsStore.get();
  return Object.values(state.items)
    .filter(item => item.type === 'project')
    .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
};

// Update project's lastModified timestamp
export const updateLastModified = (projectId: string) => {
  const currentState = projectsStore.get();
  const project = currentState.items[projectId];
  
  if (!project) return;
  
  projectsStore.set({
    ...currentState,
    items: {
      ...currentState.items,
      [projectId]: {
        ...project,
        lastModified: Date.now()
      }
    }
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
    components: [...(project.components || []), newComponent],
    lastModified: Date.now()
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

// Add a generic component update function
export const updateComponentData = async <T>(projectId: string, componentIndex: number, updatedData: T) => {
  const currentState = projectsStore.get();
  const project = currentState.items[projectId];

  if (!project || project.type !== 'project') {
    console.error('Project not found or invalid type');
    return;
  }

  if (!project.components || componentIndex >= project.components.length) {
    console.error('Component index out of bounds');
    return;
  }

  const updatedComponents = [...(project.components || [])];
  updatedComponents[componentIndex] = {
    ...updatedComponents[componentIndex],
    data: updatedData
  };

  projectsStore.set({
    ...currentState,
    items: {
      ...currentState.items,
      [projectId]: {
        ...project,
        components: updatedComponents,
        lastModified: Date.now()
      }
    }
  });

  // Return the updated project for any additional processing if needed
  return currentState.items[projectId];
};

// Initialize store in browser
if (typeof window !== 'undefined') {
  initializeStore();
}

// Re-export types
export * from './types';

export default projectsStore; 