"use client";
import { useEffect, useState } from "react";
import { useEditor } from "@/components/extensions/novel-src";

interface AITriggerManagerProps {
  // Callback for when AI state changes
  onAIStateChange: (isOpen: boolean, source?: string, isFloating?: boolean, position?: number, selectionContent?: string) => void;
}

export function AITriggerManager({ onAIStateChange }: AITriggerManagerProps) {
  const { editor } = useEditor();
  
  // Helper function to strip HTML tags and get plain text
  const stripHtml = (html: string): string => {
    // Create a temporary DOM element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    // Get the text content (strips all HTML)
    return tempDiv.textContent || tempDiv.innerText || '';
  };
  
  // Effect to handle all AI triggers from various sources
  useEffect(() => {
    const handleOpenAISelector = (event: CustomEvent) => {
      const { open, source, position, hasSelection } = event.detail || {};
      
      console.log("AI Trigger received:", { 
        open, source, position, hasSelection
      });
      
      // Always open regardless of selection state
      if (open) {
        // Get the actual selection content if there is a selection
        let selectionContent = '';
        if (hasSelection && editor) {
          const slice = editor.state.selection.content();
          const rawContent = editor.storage.markdown.serializer.serialize(slice.content);
          
          // Strip HTML tags to get clean text
          selectionContent = stripHtml(rawContent);
          
          console.log("Selection content:", {
            raw: rawContent,
            cleaned: selectionContent
          });
        }
        
        // Pass the position and selection content to the parent component
        onAIStateChange(true, source, true, position, selectionContent);
      }
    };
    
    window.addEventListener('novel:open-ai-selector', handleOpenAISelector as EventListener);
    
    return () => {
      window.removeEventListener('novel:open-ai-selector', handleOpenAISelector as EventListener);
    };
  }, [onAIStateChange, editor]);
  
  // No UI in this component - it just handles events
  return null;
}

export default AITriggerManager; 