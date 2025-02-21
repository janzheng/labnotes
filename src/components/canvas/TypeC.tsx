import React, { useState } from 'react';
import { BaseComponent, type BaseComponentProps } from './BaseComponent';
import { Button } from "@/components/ui/button";
import { actions } from 'astro:actions';
import type { TypeCData, Project } from '@/lib/stores';
import projectsStore from '@/lib/stores';

export const TypeC: React.FC<BaseComponentProps> = ({ config }) => {
  const [loading, setLoading] = useState(false);

  console.log('config', config);

  
  // Get the stored responses from config.data
  const typeCData = (config.data || {}) as TypeCData;
  const responses = typeCData.responses || [];

  const updateProjectStore = (newResponse: { message: string; timestamp: string; id: string }) => {
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
    if (!component || component.type !== 'TypeC') {
      console.error('Component not found or invalid type');
      return;
    }

    // Initialize or update the component's data
    const updatedTypeCData: TypeCData = {
      responses: [
        ...(((component.data || {}) as TypeCData).responses || []),
        newResponse
      ]
    };

    // Update the component's data in the project
    const updatedComponents = [...project.components];
    updatedComponents[config.componentIndex] = {
      ...component,
      data: updatedTypeCData
    };

    // Update the project in the store
    const updatedProject: Project = {
      ...project,
      components: updatedComponents
    };

    // Update the store
    projectsStore.set({
      ...currentState,
      items: {
        ...currentState.items,
        [config.projectId]: updatedProject
      }
    });
  };

  const handleAction = async () => {
    try {
      setLoading(true);
      const { data, error } = await actions.canvas.typeC({
        projectId: config.projectId,
        componentIndex: config.componentIndex
      });
      
      if (error) {
        console.error('Error calling Type C action:', error);
        return;
      }

      // Update the store with the new response
      updateProjectStore(data);
    } catch (error) {
      console.error('Error calling Type C action:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-purple-50 p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Type C Component</h2>
      <div className="space-y-4">
        <Button 
          onClick={handleAction}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Add Response'}
        </Button>
        
        {responses.length > 0 && (
          <div className="mt-4 space-y-2">
            {responses.map(response => (
              <div key={response.id} className="p-3 bg-white rounded-md">
                <p className="text-sm">{response.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(response.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TypeC; 