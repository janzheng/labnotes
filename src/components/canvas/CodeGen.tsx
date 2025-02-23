import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { ComponentConfig } from '@/lib/stores';
import projectsStore from '@/lib/stores';
import type { CodeGenData, CodeGenBlock, CodeGenSettings } from '@/lib/types';
import { Color } from '@tiptap/extension-color';
import ListItem from '@tiptap/extension-list-item';
import TextStyle from '@tiptap/extension-text-style';
import { useBasic, useQuery } from '@basictech/react';

const EditorBlock: React.FC<{ 
  block: CodeGenBlock;
  onUpdate: (content: string) => void;
  onRemove: () => void;
}> = ({ block, onUpdate, onRemove }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Color.configure({ types: [TextStyle.name, ListItem.name] }),
      TextStyle.configure({ types: [ListItem.name] }),
    ],
    content: block.content,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
    editorProps: {
      handleKeyDown: ({ event }) => {
        if ((event?.metaKey || event?.ctrlKey) && event?.key === 'b') {
          event?.preventDefault();
          return true;
        }
      },
    },
  });

  // Add this effect to update editor content when block content changes
  useEffect(() => {
    if (editor && editor.getHTML() !== block.content) {
      editor.commands.setContent(block.content);
    }
  }, [block.content, editor]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 p-2 border-b flex justify-between items-center">
        <span className="text-sm text-gray-600">Editor Block</span>
        <button 
          onClick={onRemove}
          className="text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      </div>
      {editor && (
        <BubbleMenu 
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="flex flex-wrap gap-1 p-2 bg-white border shadow-lg rounded-lg"
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2 py-1 rounded hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
          >
            Bold
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 rounded hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
          >
            Italic
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`px-2 py-1 rounded hover:bg-gray-100 ${editor.isActive('strike') ? 'bg-gray-200' : ''}`}
          >
            Strike
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2 py-1 rounded hover:bg-gray-100 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''}`}
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1 rounded hover:bg-gray-100 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}`}
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 rounded hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
          >
            Bullet List
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-2 py-1 rounded hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
          >
            Ordered List
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`px-2 py-1 rounded hover:bg-gray-100 ${editor.isActive('codeBlock') ? 'bg-gray-200' : ''}`}
          >
            Code Block
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`px-2 py-1 rounded hover:bg-gray-100 ${editor.isActive('blockquote') ? 'bg-gray-200' : ''}`}
          >
            Quote
          </button>
        </BubbleMenu>
      )}
      <div className="p-4">
        <EditorContent 
          editor={editor} 
          className="Codegen"
        />
      </div>
    </div>
  );
};

const CodeGen: React.FC<{ config: ComponentConfig }> = ({ config }) => {
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
    const localData = project.components[config.componentIndex].data as CodeGenData;
    
    if (!remoteProject) {
      syncToRemote(localData);
    }
  }, [remoteProject, db, isSignedIn]);

  // Keep local in sync with remote changes
  useEffect(() => {
    if (!remoteProject || !isSignedIn) return;

    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];

    if (!project || project.type !== 'project') return;

    const remoteData = remoteProject.data?.components?.[config.componentIndex]?.data as CodeGenData;
    const localData = project.components[config.componentIndex].data as CodeGenData;
    
    // Only update if the data is actually different
    if (JSON.stringify(remoteData) !== JSON.stringify(localData)) {
      console.log('Syncing local to match remote:', remoteData);
      setData(remoteData);
    }
  }, [remoteProject]);

  const syncToRemote = async (updatedData: CodeGenData) => {
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
      remoteProject = await db?.collection('projects')
        .getAll()
        .then(projects => projects.find(p => p.localId === config.projectId))
    }
  };

  // Modify updateProjectStore to include remote sync
  const updateProjectStore = async (updatedData: CodeGenData) => {
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

    // Sync to remote after local update
    await syncToRemote(updatedData);
  };

  // Initialize data with proper typing and structure
  const [data, setData] = useState<CodeGenData>(() => {
    const defaultData: CodeGenData = {
      blocks: [],
      settings: {},
      metadata: {
        title: '',
        description: '',
        tags: []
      }
    };

    // Ensure we properly type cast and merge with defaults
    if (config.data) {
      return {
        ...defaultData,
        ...(config.data as CodeGenData),
        blocks: Array.isArray((config.data as CodeGenData)?.blocks) 
          ? (config.data as CodeGenData).blocks 
          : []
      };
    }

    return defaultData;
  });

  const addBlock = (type: CodeGenBlock['type'] = 'editor') => {
    const newBlock: CodeGenBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: '',
      timestamp: new Date().toISOString()
    };

    const updatedData: CodeGenData = {
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

  const updateSettings = (newSettings: Partial<CodeGenSettings>) => {
    const updatedData = {
      ...data,
      settings: {
        ...data.settings,
        ...newSettings
      }
    };

    setData(updatedData);
    updateProjectStore(updatedData);
  };

  const updateMetadata = (newMetadata: Partial<CodeGenData['metadata']>) => {
    const updatedData = {
      ...data,
      metadata: {
        ...data.metadata,
        ...newMetadata
      }
    };

    setData(updatedData);
    updateProjectStore(updatedData);
  };

  // Initialize with one editor block if empty
  useEffect(() => {
    if (!data.blocks || data.blocks.length === 0) {
      addBlock('editor');
    }
  }, []);

  return (
    <div className="space-y-4">
      {Array.isArray(data.blocks) && data.blocks.map(block => (
        <div key={block.id} className="mb-4">
          {block.type === 'editor' && (
            <EditorBlock
              block={block}
              onUpdate={(content) => updateBlockContent(block.id, content)}
              onRemove={() => removeBlock(block.id)}
            />
          )}
          {block.type === 'metadata' && (
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Metadata Block</h3>
              <input
                type="text"
                placeholder="Title"
                value={data.metadata.title || ''}
                onChange={(e) => updateMetadata({ title: e.target.value })}
                className="border p-2 rounded w-full mb-2"
              />
              <textarea
                placeholder="Description"
                value={data.metadata.description || ''}
                onChange={(e) => updateMetadata({ description: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>
          )}
          {block.type === 'settings' && (
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Settings Block</h3>
              <select
                value={data.settings.model || ''}
                onChange={(e) => updateSettings({ model: e.target.value })}
                className="border p-2 rounded w-full mb-2"
              >
                <option value="">Select Model</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
              <input
                type="number"
                placeholder="Temperature"
                value={data.settings.temperature || ''}
                onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
                className="border p-2 rounded w-full mb-2"
              />
              <input
                type="number"
                placeholder="Max Tokens"
                value={data.settings.maxTokens || ''}
                onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) })}
                className="border p-2 rounded w-full"
              />
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <button
          onClick={() => addBlock('editor')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Editor Block
        </button>
        <button
          onClick={() => addBlock('metadata')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Add Metadata Block
        </button>
        <button
          onClick={() => addBlock('settings')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Add Settings Block
        </button>
      </div>
    </div>
  );
};


export default CodeGen; 