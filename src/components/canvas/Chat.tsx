import React, { useState } from 'react';
import { BaseComponent, type BaseComponentProps } from './BaseComponent';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actions } from 'astro:actions';
import type { ChatData } from '@/lib/stores';
import projectsStore from '@/lib/stores';

export const Chat: React.FC<BaseComponentProps> = ({ config }) => {
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');

  // Get the stored responses from config.data
  const chatData = (config.data || {}) as ChatData;
  const messages = chatData.messages || [];

  const updateProjectStore = (newMessage: { 
    prompt: string; 
    settings: { model: string; provider: string; }; 
    response: string;
    timestamp: string;
    id: string;
  }) => {
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') {
      console.error('Project not found or invalid type');
      return;
    }

    if (!project.components) {
      console.error('Project has no components');
      return;
    }

    const component = project.components[config.componentIndex];
    if (!component || component.type !== 'Chat') {
      console.error('Component not found or invalid type');
      return;
    }

    // Initialize or update the component's data
    const updatedChatData: ChatData = {
      messages: [
        ...(((component.data || {}) as ChatData).messages || []),
        newMessage
      ]
    };

    // Update the component's data in the project
    const updatedComponents = [...project.components];
    updatedComponents[config.componentIndex] = {
      ...component,
      data: updatedChatData
    };

    // Update the project in the store
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    try {
      setLoading(true);
      const { data, error } = await actions.canvas.chat({
        prompt: input.trim(),
        model: 'llama-3.1-8b-instant',
        provider: 'groq',
        projectId: config.projectId,
        componentIndex: config.componentIndex
      });
      
      if (error) {
        console.error('Error calling Chat action:', error);
        return;
      }

      // Update the store with the new message
      updateProjectStore(data);
      setInput(''); // Clear input after successful submission
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
        {/* Messages display */}
        {messages.length > 0 && (
          <div className="mt-4 space-y-2">
            {messages.map(message => (
              <div key={message.id} className="p-3 bg-white rounded-md">
                <p className="text-sm font-medium">Message: {message.prompt}</p>
                <p className="text-sm mt-2">Response: {message.response}</p>
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>{message.settings.model} ({message.settings.provider})</span>
                  <span>{new Date(message.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
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

export default Chat; 