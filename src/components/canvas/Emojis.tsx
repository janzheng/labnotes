import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import projectsStore from '@/lib/stores';
import type { ComponentConfig } from '@/lib/types';
import { useSyncedComponentData, useInitialSync } from '@/lib/basicTechSync';

const deleteCursorIcon = `url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MEE1RkEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSIzIDYgNSA2IDIxIDYiPjwvcG9seWxpbmU+PHBhdGggZD0iTTE5IDZ2MTRhMiAyIDAgMCAxLTIgMkg3YTIgMiAwIDAgMS0yLTJWNm0zIDBWNGEyIDMgMCAwIDEgMi0yaDRhMiAyIDAgMCAxIDIgMnYyIj48L3BhdGg+PC9zdmc+),auto`;

const EMOJI_LIST = ['✨', '🌟', '💫', '⭐', '🌠', '🎇', '🎆', '🌈', '🌸', '🌺', '🍀', '🎨', '🎭', '🎪', '🎡', '🎢', '🎠'];

// Define a type for the Emojis data
interface EmojisData {
  emojis: string[];
}

export const Emojis: React.FC<{ config: ComponentConfig }> = ({ config }) => {
  // Use our sync library to handle data with optional real-time updates
  const { 
    data, 
    updateData, 
    isBasicTechActive, 
    isRealtime,
    isSyncing
  } = useSyncedComponentData<EmojisData>(
    config,
    { emojis: [] },
    { realtime: true }  // Always enable realtime
  );
  
  // Handle initial sync using last-modified wins strategy
  const { 
    remoteProject, 
    syncLocalToRemote, 
    syncRemoteToLocal, 
    resolveDataConflict 
  } = useInitialSync<EmojisData>(
    config,
    { emojis: [] },
    { realtime: true }  // Always enable realtime
  );
  
  // First sync on initial load
  useEffect(() => {
    if (!isBasicTechActive) return;
    
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;
    
    const localData = (project.components[config.componentIndex].data || { emojis: [] }) as EmojisData;
    const localModified = project.lastModified || 0;
    
    // If no remote project exists yet, sync local to remote
    if (!remoteProject) {
      syncLocalToRemote(localData);
      return;
    }
    
    // If remote exists, implement last-modified strategy
    const remoteData = remoteProject.data?.components?.[config.componentIndex]?.data as EmojisData || { emojis: [] };
    const remoteModified = remoteProject.lastModified || 0;
    
    // Only resolve if data is different
    if (JSON.stringify(localData) !== JSON.stringify(remoteData)) {
      resolveDataConflict(localData, remoteData, localModified, remoteModified);
    }
  }, [remoteProject, isBasicTechActive]);

  // Use the emojis from our synced data
  const emojis = data.emojis || [];

  const addEmoji = async () => {
    const randomEmoji = EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)];
    const newEmojis = [...emojis, randomEmoji];
    await updateData({ emojis: newEmojis });
  };

  const deleteEmoji = async (index: number) => {
    const newEmojis = emojis.filter((_: string, i: number) => i !== index);
    await updateData({ emojis: newEmojis });
  };

  return (
    <div className="bg-slate-50 p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Emoji Component</h2>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <Button onClick={addEmoji} disabled={isSyncing}>
            new ✨
          </Button>
        </div>

        {isSyncing ? (
          <div className="text-xs text-blue-500">Syncing changes...</div>
        ) : (
          <div className="text-xs text-gray-500">Ready</div>
        )}
        
        {isRealtime && (
          <div className="text-xs text-green-500">Realtime updates enabled</div>
        )}

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