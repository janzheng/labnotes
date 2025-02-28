import React, { useEffect, useState, useRef } from 'react';
import type { ComponentConfig } from '@/lib/stores';
import projectsStore, { isBasicTechEnabled, updateComponentData } from '@/lib/stores';
import type { NovelData } from '@/lib/types';
import { useBasic, useQuery } from '@basictech/react';
import TailwindAdvancedEditor from '@/components/extensions/novel-tw/advanced-editor';
import type { EditorInstance } from '@/components/extensions/novel-src';

const Novel: React.FC<{ config: ComponentConfig }> = ({ config }) => {
  const basicTechEnabled = isBasicTechEnabled.get();
  const { db, isSignedIn } = useBasic();
  const lastSyncedContent = useRef<string>('');
  const editorRef = useRef<EditorInstance | null>(null);
  const componentIdRef = useRef<string>(`${config.projectId}-${config.componentIndex}`);
  
  // Add state for save status and word count
  const [saveStatus, setSaveStatus] = useState<string>("Saved");
  const [wordCount, setWordCount] = useState<number>(0);
  
  // Add this to track component renders
  console.log(`[NOVEL] Rendering component ${componentIdRef.current}`);
  
  // Get remote project data only if BasicTech is enabled
  let remoteProject = useQuery(() => 
    basicTechEnabled && isSignedIn && db?.collection('projects')
      .getAll()
      .then(projects => projects.find(p => p.localId === config.projectId))
  );

  // First sync local to remote on initial load (only if BasicTech is enabled)
  useEffect(() => {
    if (!basicTechEnabled || !isSignedIn || !db || remoteProject === undefined) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;

    // Only sync to remote if there's no remote project yet
    const localData = project.components[config.componentIndex].data as NovelData;
    
    if (!remoteProject) {
      syncToRemote(localData);
    }
  }, [remoteProject, db, isSignedIn, basicTechEnabled]);

  // Keep local in sync with remote changes (only if BasicTech is enabled)
  useEffect(() => {
    if (!basicTechEnabled || !isSignedIn || !remoteProject) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    const remoteData = remoteProject.data?.components?.[config.componentIndex]?.data as NovelData;
    const localData = project.components[config.componentIndex].data as NovelData;
    
    // Only update if the data is actually different
    if (JSON.stringify(remoteData) !== JSON.stringify(localData)) {
      console.log('Syncing local to match remote:', remoteData?.content);
      
      // Update local store with remote data
      updateComponentData(config.projectId, config.componentIndex, remoteData);
      
      // Update the editor content directly if we have a reference to it
      if (editorRef.current && remoteData?.content) {
        try {
          const contentObj = JSON.parse(remoteData.content);
          
          // Use our custom force update method
          if ((editorRef.current as any).forceUpdate) {
            (editorRef.current as any).forceUpdate(contentObj);
          } else {
            // Fallback to regular update
            editorRef.current.commands.setContent(contentObj, false);
          }
          
          lastSyncedContent.current = remoteData.content;
        } catch (error) {
          console.error('Error updating editor with remote content:', error);
        }
      }
    }
  }, [remoteProject]);

  // Initialize data with proper typing and structure
  const [data, setData] = useState<NovelData>(() => {
    const defaultData: NovelData = {
      content: '',
      lastUpdated: new Date().toISOString()
    };

    // Ensure we properly type cast and merge with defaults
    if (config.data) {
      const typedData = config.data as NovelData;
      lastSyncedContent.current = typedData.content || '';
      console.log(`[NOVEL] Initializing with content:`, typedData.content ? JSON.parse(typedData.content) : 'empty');
      return {
        ...defaultData,
        ...typedData
      };
    }

    return defaultData;
  });

  const handleContentChange = async (contentJson: string, newWordCount?: number) => {
    console.log(`[NOVEL] Content change detected for ${componentIdRef.current}`);
    
    // Skip if content hasn't actually changed (prevents unnecessary syncs)
    if (contentJson === lastSyncedContent.current) {
      console.log(`[NOVEL] Skipping update - content unchanged`);
      return;
    }
    
    console.log(`[NOVEL] Processing content change:`, JSON.parse(contentJson));
    
    // Update the ref to track the latest content
    lastSyncedContent.current = contentJson;
    
    // Update the Novel data with the new content
    const updatedData: NovelData = {
      ...data,
      content: contentJson,
      lastUpdated: new Date().toISOString()
    };

    // Update local state
    setData(updatedData);
    console.log(`[NOVEL] Local state updated with new content`);

    // Update save status
    setSaveStatus("Unsaved");

    // Update word count if provided
    if (newWordCount !== undefined) {
      setWordCount(newWordCount);
    }

    // Update component data using the generalized function
    await updateComponentData(config.projectId, config.componentIndex, updatedData);
    console.log(`[NOVEL] Store updated with new content`);
    
    // Set status back to saved after store update
    setSaveStatus("Saved");
    
    // Optionally sync to remote if BasicTech is enabled
    if (basicTechEnabled && isSignedIn) {
      await syncToRemote(updatedData);
      console.log(`[NOVEL] Remote sync completed`);
    }
  };

  // Add this effect to update the component ID ref when config changes
  useEffect(() => {
    componentIdRef.current = `${config.projectId}-${config.componentIndex}`;
  }, [config.projectId, config.componentIndex]);

  // Add this effect to update data when switching between projects
  useEffect(() => {
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;
    
    const componentData = project.components[config.componentIndex].data as NovelData;
    if (componentData) {
      console.log(`[NOVEL] Project switch detected, updating with content:`, 
        componentData.content ? JSON.parse(componentData.content) : 'empty');
      
      // Update our local state
      setData(componentData);
      
      // Update the editor content directly if we have a reference to it
      if (editorRef.current && componentData.content) {
        try {
          // Set the content in the editor directly
          const contentObj = JSON.parse(componentData.content);
          
          // Update editor content without triggering onChange
          editorRef.current.commands.setContent(contentObj, false);
          console.log(`[NOVEL] Editor content directly updated on project switch`);
          
          // Update our sync reference
          lastSyncedContent.current = componentData.content;
        } catch (error) {
          console.error('Error parsing content on project switch:', error);
        }
      }
    }
  }, [config.projectId, config.componentIndex]);

  // Add this to force reset the editor ref when switching projects
  useEffect(() => {
    // Reset editor reference when switching projects
    return () => {
      editorRef.current = null;
      lastSyncedContent.current = '';
    };
  }, [config.projectId, config.componentIndex]);

  // Optional sync to remote function - only used when BasicTech is enabled
  const syncToRemote = async (updatedData: NovelData) => {
    if (!basicTechEnabled || !isSignedIn || !db) return;

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
          ? { ...comp, data: updatedData }
          : comp
      )
    };

    try {
      if (remoteProject) {
        await db.collection('projects').update(remoteProject.id, {
          localId: config.projectId,
          data: projectData,
          lastModified: Date.now()
        });
      } else {
        await db.collection('projects').add({
          localId: config.projectId,
          data: projectData,
          lastModified: Date.now()
        });
      }
    } catch (error) {
      console.error('Error syncing to remote:', error);
      // Continue with local operations even if remote sync fails
    }
  };

  return (
    <div className="space-y-4 border p-5 rounded-lg bg-white">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Notebook Page</h2>
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg bg-accent px-2 py-1 text-muted-foreground">
            {saveStatus}
          </div>
          {wordCount > 0 && (
            <div className="rounded-lg bg-accent px-2 py-1 text-muted-foreground">
              {wordCount} Words
            </div>
          )}
          {data.lastUpdated && (
            <div className="text-xs text-gray-500">
              Last saved: {new Date(data.lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
      </div>
      <div className="novel-editor-container">
        <TailwindAdvancedEditor 
          key={`novel-editor-${config.projectId}-${config.componentIndex}`}
          defaultValue={data.content} 
          onChange={handleContentChange}
          editorRef={editorRef}
          onWordCountChange={setWordCount}
          onSaveStatusChange={setSaveStatus}
        />
      </div>
    </div>
  );
};

export default Novel; 