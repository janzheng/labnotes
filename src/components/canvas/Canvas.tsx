import React, { useEffect, useState } from 'react';
import type { Project, ComponentConfig } from '@/lib/stores';
import { addProject, assignComponentToProject, selectProject, projectsStore } from '@/lib/stores';
import TypeA from './TypeA';
import TypeB from './TypeB';
import TypeC from './TypeC';
import Chat from './Chat';
import StreamChat from './StreamChat';
import CodeGen from './CodeGen';
import LocalChat from './LocalChat';
import LocalSpeech from './LocalSpeech';
import Emojis from './Emojis';
import Novel from './Novel';

// Component map for easy lookup
const COMPONENT_MAP = {
  'TypeA': TypeA,
  'TypeB': TypeB,
  'TypeC': TypeC,
  'Chat': Chat,
  'StreamChat': StreamChat,
  'CodeGen': CodeGen,
  'LocalChat': LocalChat,
  'LocalSpeech': LocalSpeech,
  'Emojis': Emojis,
  'Notebook Page': Novel,
} as const;

// Component selection interface shown when no components are assigned
const ComponentSelector: React.FC<{ onAssignType: (type: keyof typeof COMPONENT_MAP) => void }> = ({ 
  onAssignType 
}) => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pick a component</h1>
      <div className="grid grid-cols-2 gap-4 pr-6 pl-0">
        {(Object.keys(COMPONENT_MAP) as Array<keyof typeof COMPONENT_MAP>).map((type) => (
          <button
            key={type}
            onClick={() => onAssignType(type)}
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <h3 className="font-semibold mb-2">{type}</h3>
            <p className="text-sm text-gray-600">Click to add this component</p>
          </button>
        ))}
      </div>
    </div>
  );
};

interface CanvasProps {
  project?: Project;
  onAssignType?: (type: keyof typeof COMPONENT_MAP) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ project, onAssignType }) => {
  const [titleValue, setTitleValue] = useState(project?.name || '');

  // Update titleValue when project changes
  useEffect(() => {
    if (project?.name) {
      setTitleValue(project.name);
    }
  }, [project?.name]);

  // Update URL when project changes
  useEffect(() => {
    if (project) {
      const url = `/project/${project.id}`;
      if (window.location.pathname !== url) {
        window.history.pushState({}, '', url);
      }
    }
  }, [project?.id]);

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (titleValue.trim() && project) {
      const currentState = projectsStore.get();
      projectsStore.set({
        ...currentState,
        items: {
          ...currentState.items,
          [project.id]: {
            ...currentState.items[project.id],
            name: titleValue.trim()
          }
        }
      });
    }
  };

  const handleComponentSelect = async (type: keyof typeof COMPONENT_MAP) => {
    if (!project) {
      // Create a new project if none exists
      const newProjectId = await addProject(`New ${type} Project`);
      selectProject(newProjectId);
      
      // Immediately assign the component after project creation
      assignComponentToProject(newProjectId, type);
      return;
    }
    
    if (onAssignType) {
      onAssignType(type);
    }
  };

  return (
    <div className="p-6">
      {project && (
        <form onSubmit={handleTitleSubmit} className="mb-6">
          <input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSubmit}
            className="text-4xl font-bold w-full bg-transparent focus:outline-none"
            aria-label="Project title"
          />
        </form>
      )}

      <div className="space-y-6">
        {project?.components?.map((config, index) => {
          const Component = COMPONENT_MAP[config.type];
          if (!Component) return null;
          
          // Create an enhanced config that includes projectId and componentIndex
          const enhancedConfig = {
            ...config,
            projectId: project.id,
            componentIndex: index
          };
          
          return (
            <div key={`${project.id}-${config.type}-${index}`} className="">
              {/* Force component re-mount when project changes by using project.id in the key */}
              <Component 
                key={`component-${project.id}-${index}`} 
                config={enhancedConfig} 
              />
            </div>
          );
        })}
        
        {(!project?.components?.length || !project) && (
          <ComponentSelector onAssignType={handleComponentSelect} />
        )}
      </div>
    </div>
  );
};

export default Canvas; 