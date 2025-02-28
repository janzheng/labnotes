import React, { useEffect } from 'react';
import { type BaseComponentProps } from '@/components/canvas/BaseComponent';
import { Button } from "@/components/ui/button";
import { useBasic, useQuery } from '@basictech/react';
import projectsStore, { isBasicTechEnabled, updateComponentData } from '@/lib/stores';
import type { ComponentConfig } from '@/lib/stores';

const deleteCursorIcon = `url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MEE1RkEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSIzIDYgNSA2IDIxIDYiPjwvcG9seWxpbmU+PHBhdGggZD0iTTE5IDZ2MTRhMiAyIDAgMCAxLTIgMkg3YTIgMiAwIDAgMS0yLTJWNm0zIDBWNGEyIDMgMCAwIDEgMi0yaDRhMiAyIDAgMCAxIDIgMnYyIj48L3BhdGg+PC9zdmc+),auto`;

const EMOJI_LIST = ['✨', '🌟', '💫', '⭐', '🌠', '🎇', '🎆', '🌈', '🌸', '🌺', '🍀', '🎨', '🎭', '🎪', '🎡', '🎢', '🎠'];

// Define a type for the Emojis data
interface EmojisData {
  emojis: string[];
}

export const Emojis: React.FC<{ config: ComponentConfig }> = ({ config }) => {
  const basicTechEnabled = isBasicTechEnabled.get();
  const { db, isSignedIn } = useBasic();
  
  // Get remote emojis only if BasicTech is enabled
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
    const localData = (project.components[config.componentIndex].data || { emojis: [] }) as EmojisData;
    
    if (!remoteProject) {
      syncToRemote(localData);
    }
  }, [remoteProject, db, isSignedIn, basicTechEnabled]);

  // Then keep local in sync with remote changes (only if BasicTech is enabled)
  useEffect(() => {
    if (!basicTechEnabled || !isSignedIn || !remoteProject) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    const remoteData = (remoteProject.data?.components?.[config.componentIndex]?.data || { emojis: [] }) as EmojisData;
    const localData = (project.components[config.componentIndex].data || { emojis: [] }) as EmojisData;
    
    // Only update if the data is actually different
    if (JSON.stringify(remoteData) !== JSON.stringify(localData)) {
      console.log('Syncing local to match remote:', remoteData);
      updateComponentData(config.projectId, config.componentIndex, remoteData);
    }
  }, [remoteProject]);

  // Optional sync to remote function - only used when BasicTech is enabled
  const syncToRemote = async (updatedData: EmojisData) => {
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

  // Get local emojis from the store
  const currentState = projectsStore.get();
  const project = currentState.items[config.projectId];
  const localData = (project?.components[config.componentIndex].data || { emojis: [] }) as EmojisData;
  
  // Use local data as the source of truth, only override with remote if BasicTech is enabled
  const emojis = basicTechEnabled && remoteProject?.data?.components?.[config.componentIndex]?.data?.emojis 
    ? (remoteProject.data.components[config.componentIndex].data as EmojisData).emojis 
    : localData.emojis || [];

  const addEmoji = async () => {
    const randomEmoji = EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)];
    const newEmojis = [...emojis, randomEmoji];
    const updatedData: EmojisData = { emojis: newEmojis };
    
    // Update local store - works regardless of BasicTech
    await updateComponentData(config.projectId, config.componentIndex, updatedData);
    
    // Optionally sync to remote if BasicTech is enabled
    if (basicTechEnabled && isSignedIn) {
      await syncToRemote(updatedData);
    }
  };

  const deleteEmoji = async (index: number) => {
    const newEmojis = emojis.filter((_: string, i: number) => i !== index);
    const updatedData: EmojisData = { emojis: newEmojis };
    
    // Update local store - works regardless of BasicTech
    await updateComponentData(config.projectId, config.componentIndex, updatedData);
    
    // Optionally sync to remote if BasicTech is enabled
    if (basicTechEnabled && isSignedIn) {
      await syncToRemote(updatedData);
    }
  };

  return (
    <div className="bg-slate-50 p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Emoji Component</h2>
      
      <div className="space-y-4">
        <Button onClick={addEmoji}>
          new ✨
        </Button>

        <div className="flex flex-row flex-wrap gap-4 justify-start min-h-[60px]">
          {emojis.map((emoji: string, index: number) => (
            <div 
              key={index}
              className="text-2xl rounded-md m-2 p-2 hover:bg-slate-100 transition-colors cursor-pointer"
              style={{ cursor: deleteCursorIcon }}
              onClick={() => deleteEmoji(index)}
            >
              {emoji}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Emojis; 