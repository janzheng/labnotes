import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actions } from 'astro:actions';
import type { ChatData } from '@/lib/types';
import projectsStore, { isBasicTechEnabled, updateComponentData } from '@/lib/stores';
import ReactMarkdown from 'react-markdown';
import { useBasic, useQuery } from '@basictech/react';
import type { ComponentConfig } from '@/lib/stores';

export const Chat: React.FC<{ config: ComponentConfig }> = ({ config }) => {
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const basicTechEnabled = isBasicTechEnabled.get();
  console.log('[basic.db] enabled:', basicTechEnabled);
  const { db, isSignedIn } = useBasic();
  
  // Get remote project data only if BasicTech is enabled
  let remoteProject = useQuery(() => 
    basicTechEnabled && db?.collection('projects')
      .getAll()
      .then(projects => projects.find(p => p.localId === config.projectId))
  );

  // First sync local to remote on initial load
  useEffect(() => {
    if (!basicTechEnabled || !db || !isSignedIn || remoteProject === undefined) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;

    // Only sync to remote if there's no remote project yet
    const localData = project.components[config.componentIndex].data as ChatData;
    
    if (!remoteProject) {
      syncToRemote(localData);
    }
  }, [remoteProject, db, isSignedIn, basicTechEnabled]);

  // Keep local in sync with remote changes
  useEffect(() => {
    if (!remoteProject || !isSignedIn) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    const remoteData = remoteProject.data?.components?.[config.componentIndex]?.data as ChatData;
    const localData = project.components[config.componentIndex].data as ChatData;
    
    if (JSON.stringify(remoteData) !== JSON.stringify(localData)) {
      console.log('Syncing local chat to match remote:', remoteData);
      // Update local store with remote data
      setData(remoteData);
    }
  }, [remoteProject]);

  // Helper function to set data directly in the component state
  const setData = (newData: ChatData) => {
    // Using the new generic function from the store
    updateComponentData(config.projectId, config.componentIndex, newData);
  };

  const syncToRemote = async (updatedData: ChatData) => {
    if (!basicTechEnabled || !db || !isSignedIn) return;

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

  // Get the stored chat data from config.data
  const chatData = (config.data || { messages: [] }) as ChatData;
  const messages = chatData.messages || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    try {
      setLoading(true);

      const messageHistory = messages.length === 0
        ? [{ role: "user", content: input.trim() }]
        : [
          ...messages.map(msg => ({
            role: "user",
            content: msg.text || ""
          })),
          ...messages.map(msg => ({
            role: "assistant",
            content: msg.response || ""
          })),
          { role: "user", content: input.trim() }
        ];

      const { data, error } = await actions.canvas.chat({
        model: 'llama-3.1-8b-instant',
        provider: 'groq',
        projectId: config.projectId,
        componentIndex: config.componentIndex,
        messages: messageHistory
      });

      if (error) {
        console.error('Error calling Chat action:', error);
        return;
      }

      // Update the store with the new message
      const updatedChatData: ChatData = {
        messages: [...messages, data]
      };
      
      // Update component data using the new store function
      await updateComponentData(config.projectId, config.componentIndex, updatedChatData);
      
      // Sync to remote after local update
      await syncToRemote(updatedChatData);
      
      setInput('');
    } catch (error) {
      console.error('Error calling Chat action:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Chat Component</h2>

      <div className="space-y-4">
        {messages.length > 0 && (
          <div className="mt-4 space-y-2">
            {messages.map(message => (
              <div key={message.id} className="p-3 bg-white rounded-md">
                <p className="text-sm font-medium">Message: {message.text}</p>
                <div className="text-sm mt-2 prose prose-sm max-w-none">
                  <ReactMarkdown>
                    {message.response}
                  </ReactMarkdown>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>{message.settings.model} ({message.settings.provider})</span>
                  <span>{new Date(message.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat; 