// Component Types
export type ComponentType = 
  | 'TypeA' 
  | 'TypeB' 
  | 'TypeC' 
  | 'Chat' 
  | 'StreamChat' 
  | 'CodeGen' 
  | 'LocalChat' 
  | 'LocalSpeech'
  | 'Emojis';

export type ComponentConfig = {
  type: ComponentType;
  data?: Record<string, any>; // Flexible data structure for future use
  id?: string; // Add an ID field for component instances
};

// Component-specific data types
export type TypeCData = {
  responses: Array<{
    message: string;
    timestamp: string;
    id: string;
  }>;
};

export type ChatData = {
  messages: Array<{
    text: string;
    settings: {
      model: string;
      provider: string;
    };
    response: string;
    timestamp: string;
    id: string;
    markdown?: boolean;
  }>;
};

// Project Types
export type Project = {
  id: string;
  name: string;
  parentId: string | null; // null means root level, otherwise points to a folder
  type: 'folder' | 'project';
  children?: string[]; // Only for folders - contains IDs of children
  components?: ComponentConfig[]; // Array of components assigned to this project
};

export type ProjectsState = {
  items: Record<string, Project>;
  rootIds: string[]; // IDs of root level items
};

// Add CodeGen specific types
export type CodeGenBlock = {
  id: string;
  type: 'editor' | 'metadata' | 'settings';
  content: string;
  timestamp: string;
};

export type CodeGenSettings = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type CodeGenData = {
  blocks: CodeGenBlock[];
  settings: CodeGenSettings;
  metadata: {
    title?: string;
    description?: string;
    tags?: string[];
  };
}; 