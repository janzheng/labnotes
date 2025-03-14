import React, { useEffect, useState } from 'react';
import type { Project, ComponentConfig } from '@/lib/stores';
import { addProject, assignComponentToProject, selectProject, projectsStore } from '@/lib/stores';
import TypeA from './TypeA';
import TypeB from './TypeB';
import TypeC from './TypeC';
import Chat from './Chat';
import CodeGen from './CodeGen';
import LocalChat from './LocalChat';
import LocalSpeech from './LocalSpeech';
import Emojis from './Emojis';
import StreamChat from './StreamChat';
import Novel from './Novel';

// Combined component registry with display names and components
const COMPONENTS = [
  {
    id: 'StreamChat',
    displayName: 'Streaming Chat',
    component: StreamChat,
    metadata: {
      description: 'Real-time streaming chat interface',
      category: 'communication'
    }
  },
  {
    id: 'Notebook',
    displayName: 'Notebook',
    component: Novel,
    metadata: {
      description: 'Interactive notebook for writing and organizing content',
      category: 'productivity'
    }
  },
  // Commented out components still included in the registry for future use
  /*
  {
    id: 'TypeA',
    displayName: 'Type A Component',
    component: TypeA,
    metadata: {
      description: 'Type A component description',
      category: 'utility'
    }
  },
  {
    id: 'TypeB',
    displayName: 'Type B Component',
    component: TypeB,
    metadata: {
      description: 'Type B component description',
      category: 'utility'
    }
  },
  {
    id: 'TypeC',
    displayName: 'Type C Component',
    component: TypeC,
    metadata: {
      description: 'Type C component description',
      category: 'utility'
    }
  },
  {
    id: 'Chat',
    displayName: 'Chat Interface',
    component: Chat,
    metadata: {
      description: 'Basic chat interface',
      category: 'communication'
    }
  },
  {
    id: 'CodeGen',
    displayName: 'Code Generator',
    component: CodeGen,
    metadata: {
      description: 'Generate code snippets',
      category: 'development'
    }
  },
  {
    id: 'LocalChat',
    displayName: 'Local Chat',
    component: LocalChat,
    metadata: {
      description: 'Local-only chat interface',
      category: 'communication'
    }
  },
  {
    id: 'LocalSpeech',
    displayName: 'Local Speech',
    component: LocalSpeech,
    metadata: {
      description: 'Local speech recognition and synthesis',
      category: 'accessibility'
    }
  },
  {
    id: 'Emojis',
    displayName: 'Emoji Picker',
    component: Emojis,
    metadata: {
      description: 'Emoji selection interface',
      category: 'utility'
    }
  },
  */
] as const;

// Create a type for component IDs
type ComponentId = typeof COMPONENTS[number]['id'];

// Create a lookup map for easier component access by ID
const COMPONENT_MAP = COMPONENTS.reduce((map, comp) => {
  map[comp.id] = comp.component;
  return map;
}, {} as Record<ComponentId, React.ComponentType<any>>);

// Helper function to get component info by ID
const getComponentInfo = (id: ComponentId) => {
  return COMPONENTS.find(comp => comp.id === id);
};

// Component selection interface shown when no components are assigned
const ComponentSelector: React.FC<{ onAssignType: (type: ComponentId) => void }> = ({ 
  onAssignType 
}) => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pick a component</h1>
      <div className="grid grid-cols-2 gap-4 pr-6 pl-0">
        {COMPONENTS.map((comp) => (
          <button
            key={comp.id}
            onClick={() => onAssignType(comp.id)}
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <h3 className="font-semibold mb-2">{comp.displayName}</h3>
            <p className="text-sm text-gray-600">{comp.metadata.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

// Component wrapper with header
const ComponentWrapper: React.FC<{
  type: ComponentId,
  children: React.ReactNode
}> = ({
  type,
  children
}) => {
  const componentInfo = getComponentInfo(type);
  
  return (
    <div className="relative ">
      <div className="">
        {/* <h3 className="font-semibold">{componentInfo?.displayName || type}</h3> */}
      </div>
      {children}
    </div>
  );
};

interface CanvasProps {
  project?: Project;
  onAssignType?: (type: ComponentId) => void;
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

  const handleComponentSelect = async (type: ComponentId) => {
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

  // Function to add another component to the current project
  // Currently not used in the UI, but available for future UX implementation
  const addComponentToCurrentProject = (type: ComponentId) => {
    if (!project) return;
    
    assignComponentToProject(project.id, type);
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
            <div key={`${project.id}-${config.type}-${index}`}>
              <ComponentWrapper type={config.type}>
                {/* Force component re-mount when project changes by using project.id in the key */}
                <Component 
                  key={`component-${project.id}-${index}`} 
                  config={enhancedConfig} 
                />
              </ComponentWrapper>
            </div>
          );
        })}
        
        {(!project?.components?.length || !project) && (
          <ComponentSelector onAssignType={handleComponentSelect} />
        )}
        
        {/* Placeholder for future multi-component UI
        {project?.components?.length > 0 && (
          <div className="mt-8">
            <button 
              onClick={() => setShowComponentSelector(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add Another Component
            </button>
            
            {showComponentSelector && (
              <div className="mt-4">
                <ComponentSelector onAssignType={(type) => {
                  addComponentToCurrentProject(type);
                  setShowComponentSelector(false);
                }} />
              </div>
            )}
          </div>
        )}
        */}
      </div>
    </div>
  );
};

export default Canvas; 