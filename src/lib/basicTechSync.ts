import { useBasic, useQuery } from '@basictech/react';
import projectsStore, { isBasicTechEnabled, updateComponentData } from '@/lib/stores';
import type { ComponentConfig } from '@/lib/types';
import { useEffect, useState } from 'react';

/**
 * Helper function to determine if a BasicTech session is active
 */
export function useBasicTechSession() {
  const basicTechEnabled = isBasicTechEnabled.get();
  const { db, isSignedIn } = useBasic();
  
  // Add a helper function to find a project by localId
  const findProjectByLocalId = async (localId: string) => {
    if (!db) return null;
    const projects = await db.collection('projects').getAll();
    return projects.find(p => p.localId === localId) || null;
  };
  
  return {
    isActive: !!basicTechEnabled && !!isSignedIn && !!db,
    db,
    isSignedIn,
    basicTechEnabled,
    findProjectByLocalId
  };
}

/**
 * Hook for synchronizing component data between local storage and BasicTech
 * @param config Component configuration
 * @param initialLocalData Default data to use if no data exists
 * @param options Additional options for the sync behavior
 */
export function useSyncedComponentData<T extends Record<string, any>>(
  config: ComponentConfig, 
  initialLocalData: T,
  options: {
    realtime?: boolean;  // Whether to use real-time updates via WebSockets
  } = {}
) {
  const { isActive, db, findProjectByLocalId } = useBasicTechSession();
  const [isSyncing, setIsSyncing] = useState(false);
  const { realtime = false } = options;
  
  // Fetch remote project data with optional real-time updates
  const remoteProject = useQuery(
    () => isActive && db?.collection('projects')
      .getAll()
      .then(projects => projects.find(p => p.localId === config.projectId)),
    [isActive, db, config.projectId],
    { subscribe: realtime }
  );

  // Function to synchronize data to the remote BasicTech database
  const syncToRemote = async (updatedData: T) => {
    if (!isActive || !db) {
      console.log('Not active or no database');
      return;
    }
    setIsSyncing(true);

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    console.log('Project:', project);

    if (!project || project.type !== 'project') {
      setIsSyncing(false);
      return;
    }

    console.log('Project data:', project.components);

    const projectData = {
      id: project.id,
      name: project.name,
      parentId: project.parentId,
      type: project.type,
      components: project.components.map((comp, index) => 
        index === config.componentIndex 
          ? { ...comp, data: updatedData }
          : comp
      )
    };

    console.log('Project data:', projectData, await db.collection('projects').getAll());

    try {
      // Find existing project by localId instead of relying on remoteProject
      const existingProject = await findProjectByLocalId(config.projectId);
      
      if (existingProject) {
        // Update existing project
        await db.collection('projects').update(existingProject.id, {
          localId: config.projectId,
          data: projectData,
          lastModified: Date.now()
        });
        console.log('Updated existing project:', existingProject.id);
      } else {
        // Create new project only if one doesn't exist
        await db.collection('projects').add({
          localId: config.projectId,
          data: projectData,
          lastModified: Date.now()
        });
        console.log('Added new project with localId:', config.projectId);
      }
    } catch (error) {
      console.error('Error syncing to remote:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Function to update component data (both locally and remotely if BasicTech is active)
  const updateData = async (updatedData: T) => {
    // Always update local store first
    await updateComponentData(config.projectId, config.componentIndex, updatedData);

    console.log('Updated local data:', isActive, updatedData);
    
    // Optionally sync to remote if BasicTech is enabled
    if (isActive) {
      await syncToRemote(updatedData);
    }
  };

  // Update local storage when real-time remote data changes
  useEffect(() => {
    if (!isActive || !realtime || !remoteProject || isSyncing) return;
    
    const remoteData = remoteProject?.data?.components?.[config.componentIndex]?.data as T;
    if (!remoteData) return;
    
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;
    
    const localData = (project.components[config.componentIndex].data || initialLocalData) as T;
    
    // Only update if data is different - prevents infinite loops
    if (JSON.stringify(remoteData) !== JSON.stringify(localData)) {
      console.log('Real-time update received, syncing to local storage:', remoteData);
      updateComponentData(config.projectId, config.componentIndex, remoteData);
    }
  }, [remoteProject, isActive, realtime, isSyncing, config.projectId, config.componentIndex, initialLocalData]);

  // Get local data from store
  const currentState = projectsStore.get();
  const project = currentState.items[config.projectId];
  const localData = (project?.components[config.componentIndex]?.data || initialLocalData) as T;
  
  // Determine which data to use (remote takes precedence if available)
  const remoteData = remoteProject?.data?.components?.[config.componentIndex]?.data as T;
  const data = isActive && remoteData ? remoteData : localData;

  return {
    data,
    updateData,
    isBasicTechActive: isActive,
    isRealtime: realtime && isActive,
    remoteData,
    localData,
    syncToRemote,
    isSyncing
  };
}

/**
 * Setup initial sync between local and remote data
 * Uses last-modified approach to decide which data should win
 */
export function useInitialSync<T extends Record<string, any>>(
  config: ComponentConfig,
  initialLocalData: T,
  options: {
    realtime?: boolean;  // Whether to use real-time for initial sync query
  } = {}
) {
  const { isActive, db, findProjectByLocalId } = useBasicTechSession();
  const { realtime = false } = options;
  
  // Get remote project data if BasicTech is active
  const remoteProject = useQuery(
    () => isActive && db?.collection('projects')
      .getAll()
      .then(projects => projects.find(p => p.localId === config.projectId)),
    [isActive, db, config.projectId],
    { subscribe: realtime }
  );
  
  // Function to sync local data to remote
  const syncLocalToRemote = async (localData: T) => {
    if (!isActive || !db) return;
    
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;
    
    const projectData = {
      id: project.id,
      name: project.name,
      parentId: project.parentId,
      type: project.type,
      components: project.components.map((comp, index) => 
        index === config.componentIndex 
          ? { ...comp, data: localData }
          : comp
      )
    };
    
    try {
      // Check if project already exists
      const existingProject = await findProjectByLocalId(config.projectId);
      
      if (existingProject) {
        // Update existing project
        await db.collection('projects').update(existingProject.id, {
          localId: config.projectId,
          data: projectData,
          lastModified: Date.now()
        });
      } else {
        // Create new project only if one doesn't exist
        await db.collection('projects').add({
          localId: config.projectId,
          data: projectData,
          lastModified: Date.now()
        });
      }
    } catch (error) {
      console.error('Error syncing local to remote:', error);
    }
  };
  
  // Function to sync remote data to local
  const syncRemoteToLocal = async (remoteData: T) => {
    await updateComponentData(config.projectId, config.componentIndex, remoteData);
  };

  // Function to determine which data is more recent
  const resolveDataConflict = async (localData: T, remoteData: T, localModified: number, remoteModified: number) => {
    // Last-modified wins strategy
    if (remoteModified > localModified) {
      await syncRemoteToLocal(remoteData);
      return remoteData;
    } else {
      await syncLocalToRemote(localData);
      return localData;
    }
  };
  
  return {
    remoteProject,
    syncLocalToRemote,
    syncRemoteToLocal,
    resolveDataConflict,
    isBasicTechActive: isActive,
    isRealtime: realtime && isActive
  };
} 