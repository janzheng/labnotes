// Define common types used across AI selector components

// Type for message history
export interface AIMessage {
  role: string;
  content: string;
}

// Type for threadgirl prompts
export interface ThreadgirlPrompt {
  _id?: string;
  name: string;
  prompt: string;
  date?: string;
  hash?: string;
}

// Enum for different AI selector modes
export enum AISelectorMode {
  DEFAULT = 'default',
  IMAGE_GENERATION = 'image_generation',
  THREADGIRL = 'threadgirl',
  COMPLETION = 'completion'
}

// Type for AI selector state
export interface AISelectorState {
  mode: AISelectorMode;
  inputValue: string;
  completion: string;
  messageHistory: AIMessage[];
  action: string | null;
  lastPrompt: string;
}

// Type for AI selector props
export interface AISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromSlashCommand?: boolean;
  isFloating?: boolean;
  selectionContent?: string;
}

// Constants for action types
export const AI_ACTIONS = {
  DEFAULT_COMPLETION: 'default_completion',
  TRANSFORM_SELECTION: 'transform_selection',
  IGNORE_COMPLETION: 'ignore_completion',
  SET_INPUT: 'set_input'
}; 