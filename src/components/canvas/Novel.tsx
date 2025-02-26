import React, { useEffect, useState } from 'react';
import type { ComponentConfig } from '@/lib/stores';
import projectsStore from '@/lib/stores';
import { useBasic, useQuery } from '@basictech/react';
import TailwindAdvancedEditor from "@/components/extensions/novel-tw/advanced-editor";

interface NovelData {
  blocks: NovelBlock[];
  settings: NovelSettings;
  metadata: {
    title: string;
    description: string;
    tags: string[];
  };
}

interface NovelBlock {
  id: string;
  type: 'editor' | 'metadata' | 'settings';
  content: string;
  timestamp: string;
}

interface NovelSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const EditorBlock: React.FC<{ 
  block: NovelBlock;
  onUpdate: (content: string) => void;
  onRemove: () => void;
}> = ({ block, onUpdate, onRemove }) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 p-2 border-b flex justify-between items-center">
        <span className="text-sm text-gray-600">Novel Block</span>
        <button 
          onClick={onRemove}
          className="text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      </div>
      <div className="">
        <TailwindAdvancedEditor 
          defaultValue={block.content}
          onChange={(value) => onUpdate(value)}
        />
      </div>
    </div>
  );
};

const Novel: React.FC<{ config: ComponentConfig }> = ({ config }) => {
  const { db, isSignedIn } = useBasic();
  
  let remoteProject = useQuery(() => 
    db?.collection('projects')
      .getAll()
      .then(projects => projects.find(p => p.localId === config.projectId))
  );

  useEffect(() => {
    if (!db || !isSignedIn || remoteProject === undefined) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;

    const localData = project.components[config.componentIndex].data as NovelData;
    
    if (!remoteProject) {
      syncToRemote(localData);
    }
  }, [remoteProject, db, isSignedIn]);

  useEffect(() => {
    if (!remoteProject || !isSignedIn) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    const remoteData = remoteProject.data?.components?.[config.componentIndex]?.data as NovelData;
    const localData = project.components[config.componentIndex].data as NovelData;
    
    if (JSON.stringify(remoteData) !== JSON.stringify(localData)) {
      setData(remoteData);
    }
  }, [remoteProject]);

  const syncToRemote = async (updatedData: NovelData) => {
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

  const [data, setData] = useState<NovelData>(() => {
    const defaultData: NovelData = {
      blocks: [],
      settings: {},
      metadata: {
        title: '',
        description: '',
        tags: []
      }
    };

    if (config.data) {
      return {
        ...defaultData,
        ...(config.data as NovelData),
        blocks: Array.isArray((config.data as NovelData)?.blocks) 
          ? (config.data as NovelData).blocks 
          : []
      };
    }

    return defaultData;
  });

  const updateProjectStore = async (updatedData: NovelData, shouldSyncRemote = true) => {
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') {
      console.error('Project not found or invalid type');
      return;
    }

    const updatedComponents = [...(project.components || [])];
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

    if (shouldSyncRemote) {
      await syncToRemote(updatedData);
    }
  };

  const addBlock = (type: NovelBlock['type'] = 'editor') => {
    const newBlock: NovelBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: '',
      timestamp: new Date().toISOString()
    };

    const updatedData: NovelData = {
      ...data,
      blocks: [...(data.blocks || []), newBlock]
    };

    setData(updatedData);
    updateProjectStore(updatedData);
  };

  const updateBlockContent = (blockId: string, content: string) => {
    const updatedData = {
      ...data,
      blocks: data.blocks.map(block => 
        block.id === blockId 
          ? { ...block, content, timestamp: new Date().toISOString() }
          : block
      )
    };

    setData(updatedData);
    updateProjectStore(updatedData);
  };

  const removeBlock = (blockId: string) => {
    const updatedData = {
      ...data,
      blocks: data.blocks.filter(block => block.id !== blockId)
    };

    setData(updatedData);
    updateProjectStore(updatedData);
  };

  useEffect(() => {
    if (!data.blocks || data.blocks.length === 0) {
      addBlock('editor');
    }
  }, []);

  return (
    <div className="space-y-4">
      {Array.isArray(data.blocks) && data.blocks.map(block => (
        <div key={block.id} className="mb-4">
          <EditorBlock
            block={block}
            onUpdate={(content) => updateBlockContent(block.id, content)}
            onRemove={() => removeBlock(block.id)}
          />
        </div>
      ))}

      <div className="flex gap-2">
        <button
          onClick={() => addBlock('editor')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Novel Block
        </button>
      </div>
    </div>
  );
};

export default Novel; 