import React, { useEffect } from 'react';
import { type BaseComponentProps } from '@/components/canvas/BaseComponent';
import { Button } from "@/components/ui/button";
import { useBasic, useQuery } from '@basictech/react';
import projectsStore from '@/lib/stores';

const deleteCursorIcon = `url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MEE1RkEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSIzIDYgNSA2IDIxIDYiPjwvcG9seWxpbmU+PHBhdGggZD0iTTE5IDZ2MTRhMiAyIDAgMCAxLTIgMkg3YTIgMiAwIDAgMS0yLTJWNm0zIDBWNGEyIDMgMCAwIDEgMi0yaDRhMiAyIDAgMCAxIDIgMnYyIj48L3BhdGg+PC9zdmc+),auto`;

const EMOJI_LIST = ['✨', '🌟', '💫', '⭐', '🌠', '🎇', '🎆', '🌈', '🌸', '🌺', '🍀', '🎨', '🎭', '🎪', '🎡', '🎢', '🎠'];

export const Emojis: React.FC<BaseComponentProps> = ({ config }) => {
  const { db, isSignedIn } = useBasic();
  
  // Get remote emojis
  const remoteProject = useQuery(() => 
    db?.collection('projects')
      .getAll()
      .then(projects => projects.find(p => p.localId === config.projectId))
  );

  console.log('remoteProject', remoteProject);

  // First sync local to remote on initial load
  useEffect(() => {
    if (!db || !isSignedIn || remoteProject === undefined) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;

    // Only sync to remote if there's no remote project yet
    const localEmojis = ((project.components[config.componentIndex].data || {}) as any).emojis || [];
    
    if (!remoteProject) {
      syncToRemote(localEmojis);
    }
  }, [remoteProject, db, isSignedIn]);

  // Then keep local in sync with remote changes
  useEffect(() => {
    if (!remoteProject || !isSignedIn) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    const remoteEmojis = remoteProject.data?.components?.[config.componentIndex]?.data?.emojis || [];
    const localEmojis = ((project.components[config.componentIndex].data || {}) as any).emojis || [];
    
    // Only update if the arrays are actually different
    if (JSON.stringify(remoteEmojis) !== JSON.stringify(localEmojis)) {
      console.log('Syncing local to match remote:', remoteEmojis);
      
      const updatedComponents = [...project.components];
      updatedComponents[config.componentIndex] = {
        ...project.components[config.componentIndex],
        data: { emojis: [...remoteEmojis] }
      };

      projectsStore.set({
        ...currentState,
        items: {
          ...currentState.items,
          [config.projectId]: {
            ...project,
            components: updatedComponents
          }
        }
      });
    }
  }, [remoteProject]);

  // Get local emojis
  const currentState = projectsStore.get();
  const project = currentState.items[config.projectId];
  const localEmojis = ((project?.components[config.componentIndex].data || {}) as any).emojis || [];
  
  // Just use remote emojis since it's our source of truth
  const allEmojis = remoteProject?.data?.components?.[config.componentIndex]?.data?.emojis || localEmojis;

  const updateProjectStore = (emojis: string[]) => {
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    const updatedComponents = [...project.components];
    updatedComponents[config.componentIndex] = {
      ...project.components[config.componentIndex],
      data: { emojis }
    };

    projectsStore.set({
      ...currentState,
      items: {
        ...currentState.items,
        [config.projectId]: {
          ...project,
          components: updatedComponents
        }
      }
    });
  };

  const syncToRemote = async (emojis: string[]) => {
    if (!db || !isSignedIn) return;

    // Get current project state to preserve structure
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    // Create updated project data
    const projectData = {
      id: project.id,
      name: project.name,
      parentId: project.parentId,
      type: project.type,
      components: project.components.map((comp, index) => 
        index === config.componentIndex 
          ? { ...comp, data: { emojis } }
          : comp
      )
    };

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
      remoteProject = await db?.collection('projects')
        .getAll()
        .then(projects => projects.find(p => p.localId === config.projectId))
    }
  };

  const addEmoji = async () => {
    if (!isSignedIn) return;
    
    const randomEmoji = EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)];
    const newEmojis = [...allEmojis, randomEmoji];
    
    updateProjectStore(newEmojis);
    await syncToRemote(newEmojis);
  };

  const deleteEmoji = async (index: number) => {
    if (!isSignedIn) return;
    
    const newEmojis = allEmojis.filter((_: string, i: number) => i !== index);
    
    updateProjectStore(newEmojis);
    await syncToRemote(newEmojis);
  };

  return (
    <div className="bg-slate-50 p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Emoji Component</h2>
      
      <div className="space-y-4">
        <Button onClick={addEmoji}>
          new ✨
        </Button>

        <div className="flex flex-row flex-wrap gap-4 justify-start min-h-[60px]">
          {allEmojis.map((emoji: string, index: number) => (
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