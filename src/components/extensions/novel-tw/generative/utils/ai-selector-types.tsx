import { useState, createContext, useContext } from 'react';

// Existing types
export enum AISelectorMode {
  DEFAULT = "default",
  COMPLETION = "completion",
  IMAGE_GENERATION = "image_generation",
  THREADGIRL = "threadgirl",
}

export interface AISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromSlashCommand?: boolean;
  isFloating?: boolean;
  selectionContent?: string;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export const AI_ACTIONS = {
  DEFAULT_COMPLETION: "default_completion",
  TRANSFORM_SELECTION: "transform_selection",
  IGNORE_COMPLETION: "ignore_completion",
};

// New event manager types
export type AIOperationType = 
  | 'loading_prompts'
  | 'running_prompt' 
  | 'generating_image'
  | 'standard_completion' 
  | null;

export interface AIOperationState {
  isLoading: boolean;
  operationType: AIOperationType;
  operationName?: string;
  progress?: number;
}

export interface AIEventManagerContextType {
  // Current operation state
  operationState: AIOperationState;
  
  // Methods to update state
  startOperation: (type: AIOperationType, name?: string) => void;
  updateProgress: (progress: number) => void;
  endOperation: () => void;
  
  // Mode management
  mode: AISelectorMode;
  setMode: (mode: AISelectorMode) => void;
  
  // Results management
  results: {
    threadgirl: string | null;
    completion: string | null;
    imageUrl: string | null;
  };
  setResult: (type: 'threadgirl' | 'completion' | 'imageUrl', result: string | null) => void;
}

// Create context with default values
export const AIEventManagerContext = createContext<AIEventManagerContextType>({
  operationState: {
    isLoading: false,
    operationType: null,
  },
  startOperation: () => {},
  updateProgress: () => {},
  endOperation: () => {},
  mode: AISelectorMode.DEFAULT,
  setMode: () => {},
  results: {
    threadgirl: null,
    completion: null,
    imageUrl: null,
  },
  setResult: () => {},
});

// Hook to use the AI Event Manager
export const useAIEventManager = () => useContext(AIEventManagerContext);

// Provider component to wrap the AI Selector with
export const AIEventManagerProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // State for tracking the current operation
  const [operationState, setOperationState] = useState<AIOperationState>({
    isLoading: false,
    operationType: null,
  });
  
  // State for tracking mode
  const [mode, setMode] = useState<AISelectorMode>(AISelectorMode.DEFAULT);
  
  // State for tracking results
  const [results, setResults] = useState({
    threadgirl: null,
    completion: null,
    imageUrl: null,
  });
  
  // Start a new operation
  const startOperation = (type: AIOperationType, name?: string) => {
    setOperationState({
      isLoading: true,
      operationType: type,
      operationName: name,
      progress: 0,
    });
  };
  
  // Update the progress of an operation
  const updateProgress = (progress: number) => {
    setOperationState(prev => ({
      ...prev,
      progress,
    }));
  };
  
  // End the current operation
  const endOperation = () => {
    setOperationState({
      isLoading: false,
      operationType: null,
      progress: undefined,
    });
  };
  
  // Set a result
  const setResult = (type: 'threadgirl' | 'completion' | 'imageUrl', result: string | null) => {
    setResults(prev => ({
      ...prev,
      [type]: result,
    }));
  };
  
  return (
    <AIEventManagerContext.Provider 
      value={{
        operationState,
        startOperation,
        updateProgress,
        endOperation,
        mode,
        setMode,
        results,
        setResult,
      }}
    >
      {children}
    </AIEventManagerContext.Provider>
  );
}; 