import React, { useState, useEffect } from 'react';
import { BaseComponent, type BaseComponentProps } from './BaseComponent';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from 'react-markdown';
import { actions } from 'astro:actions';
import type { ChatData } from '@/lib/types';
import projectsStore, { isBasicTechEnabled, updateComponentData } from '@/lib/stores';
import { nanoid } from 'nanoid';
import { useBasic, useQuery } from '@basictech/react';
import type { ComponentConfig } from '@/lib/stores';

export const StreamChat: React.FC<{ config: ComponentConfig }> = ({ config }) => {
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const basicTechEnabled = isBasicTechEnabled.get();
  // console.log('[basic.db] enabled:', basicTechEnabled);
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

    const promptText = input.trim(); // Store the input before clearing it
    setUserPrompt(promptText); // Set the prompt for display
    
    try {
      setLoading(true);
      setCurrentStreamingMessage(''); // Reset streaming message
      setInput(''); // Clear input early
      
      const messageHistory = messages.length === 0 
        ? [{ role: "user", content: promptText }]
        : [
            ...messages.map(msg => ({
              role: "user",
              content: msg.text || ""
            })),
            ...messages.map(msg => ({
              role: "assistant",
              content: msg.response || ""
            })),
            { role: "user", content: promptText }
          ];

      const response = await fetch('/api/stream-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-specdec',
          provider: 'groq',
          messages: messageHistory
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed && typeof parsed === 'string') {
                fullResponse += parsed;
                setCurrentStreamingMessage(prev => prev + parsed);
              }
            } catch (e) {
              console.warn('Failed to parse streaming data:', e);
            }
          }
        }
      }

      // After streaming is complete, update the store with the final message
      const newMessage = {
        text: promptText,
        settings: { model: 'llama-3.3-70b-specdec', provider: 'groq' },
        response: fullResponse,
        timestamp: new Date().toISOString(),
        id: nanoid()
      };

      // Update the store with the new message
      const updatedChatData: ChatData = {
        messages: [...messages, newMessage]
      };
      
      // Update component data using the new store function
      await updateComponentData(config.projectId, config.componentIndex, updatedChatData);
      
      // Sync to remote after local update
      await syncToRemote(updatedChatData);
      
      setCurrentStreamingMessage(''); // Clear streaming message after storing
      setUserPrompt(''); // Clear the prompt after storing

    } catch (error) {
      console.error('Error in chat stream:', error);
      setCurrentStreamingMessage('Error: Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Stream Chat Component</h2>
      
      <div className="space-y-4">
        {/* Messages display */}
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

        {/* Only show streaming message if there isn't a stored message with the same content */}
        {currentStreamingMessage && (
          <div className="p-3 bg-white rounded-md">
            <p className="text-sm font-medium">Message: {userPrompt}</p>
            <div className="text-sm mt-2 prose prose-sm max-w-none">
              <ReactMarkdown>
                {currentStreamingMessage}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Input form */}
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

export default StreamChat; 