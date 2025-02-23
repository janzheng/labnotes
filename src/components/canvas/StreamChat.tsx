import React, { useState, useEffect } from 'react';
import { BaseComponent, type BaseComponentProps } from './BaseComponent';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from 'react-markdown';
import { actions } from 'astro:actions';
import type { ChatData } from '@/lib/stores';
import projectsStore from '@/lib/stores';
import { nanoid } from 'nanoid';
import { useBasic, useQuery } from '@basictech/react';

export const StreamChat: React.FC<BaseComponentProps> = ({ config }) => {
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const { db, isSignedIn } = useBasic();
  
  // Get remote project data
  let remoteProject = useQuery(() => 
    db?.collection('projects')
      .getAll()
      .then(projects => projects.find(p => p.localId === config.projectId))
  );

  // First sync local to remote on initial load
  useEffect(() => {
    if (!db || !isSignedIn || remoteProject === undefined) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;

    // Only sync to remote if there's no remote project yet
    if (!remoteProject) {
      syncToRemote(project.components[config.componentIndex].data);
    }
  }, [remoteProject, db, isSignedIn]);

  // Keep local in sync with remote changes
  useEffect(() => {
    if (!remoteProject || !isSignedIn) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    const remoteData = remoteProject.data?.components?.[config.componentIndex]?.data;
    const localData = project.components[config.componentIndex].data;
    
    if (JSON.stringify(remoteData) !== JSON.stringify(localData)) {
      console.log('Syncing local chat to match remote:', remoteData);
      // Update local store with remote data
      updateProjectStore(remoteData, false);
    }
  }, [remoteProject]);

  const syncToRemote = async (updatedData: ChatData) => {
    if (!db || !isSignedIn) return;

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
    }
  };

  // Get the stored responses from config.data
  const chatData = (config.data || {}) as ChatData;
  const messages = chatData.messages || [];

  const updateProjectStore = async (newData: ChatData | { 
    prompt: string; 
    settings: { model: string; provider: string; }; 
    response: string;
    timestamp: string;
    id: string;
  }, shouldSyncRemote = true) => {
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') {
      console.error('Project not found or invalid type');
      return;
    }

    // If newData is a message, convert it to ChatData format
    const updatedData: ChatData = 'messages' in newData ? newData : {
      messages: [
        ...(((project.components[config.componentIndex].data || {}) as ChatData).messages || []),
        newData
      ]
    };

    const updatedComponents = [...project.components];
    updatedComponents[config.componentIndex] = {
      ...updatedComponents[config.componentIndex],
      data: updatedData
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

    // Only sync to remote if flag is true
    if (shouldSyncRemote) {
      await syncToRemote(updatedData);
    }
  };

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
              content: msg.prompt || ""
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
        prompt: promptText,
        settings: { model: 'llama-3.1-8b-instant', provider: 'groq' },
        response: fullResponse,
        timestamp: new Date().toISOString(),
        id: nanoid()
      };

      updateProjectStore(newMessage);
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
                <p className="text-sm font-medium">Message: {message.prompt}</p>
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