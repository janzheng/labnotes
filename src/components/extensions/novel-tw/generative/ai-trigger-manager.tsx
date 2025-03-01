"use client";
import React from "react";
import { useEffect, useState } from "react";
import { useEditor } from "@/components/extensions/novel-src";

interface AITriggerManagerProps {
  // Callback for when AI state changes
  onAIStateChange: (isOpen: boolean, source?: string, isFloating?: boolean, position?: number, selectionContent?: string) => void;
}

export function AITriggerManager({ onAIStateChange }: AITriggerManagerProps) {
  const { editor } = useEditor();
  const [lastSelectionTime, setLastSelectionTime] = useState(0);
  const [savedCursorPosition, setSavedCursorPosition] = useState<number | null>(null);
  
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
      const { open, source, position, hasSelection, selectionContent: eventSelectionContent } = event.detail || {};
      
      console.log("AI Trigger received:", { 
        open, source, position, hasSelection
      });
      
      // Always open regardless of selection state
      if (open) {
        // Save current cursor position before opening AI selector
        if (editor) {
          const currentPos = position || editor.state.selection.from;
          console.log("[AI-TRIGGER-MANAGER] Saving cursor position:", currentPos);
          setSavedCursorPosition(currentPos);
        }
        
        // Get the actual selection content if there is a selection and it wasn't provided in the event
        let selectionContent = eventSelectionContent || '';
        if (!selectionContent && hasSelection && editor) {
          const slice = editor.state.selection.content();
          const rawContent = editor.storage.markdown.serializer.serialize(slice.content);
          
          // Strip HTML tags to get clean text
          selectionContent = stripHtml(rawContent);
          
          console.log("Selection content:", {
            raw: rawContent,
            cleaned: selectionContent
          });
        }
        
        // For specific sources, we want to open the AI selector directly
        // IMPORTANT: Include 'keyboard' and 'space' in the list of valid sources
        const shouldOpenAISelector = 
          source === 'slash-command' || 
          source === 'space-command' || 
          source === 'mod-k' || 
          source === 'keyboard' || 
          source === 'space' || 
          source === 'button';
        
        if (shouldOpenAISelector) {
          // Pass the position and selection content to the parent component
          // This will open the AI selector directly
          onAIStateChange(true, source, true, position, selectionContent);
        }
      } else if (source === 'cancel' && savedCursorPosition !== null && editor) {
        // Handle cancel event - restore cursor position
        console.log("[AI-TRIGGER-MANAGER] Restoring cursor position:", savedCursorPosition);
        setTimeout(() => {
          editor.commands.setTextSelection(savedCursorPosition);
          editor.commands.focus();
        }, 10);
      }
    };
    
    // Listen for both open and cancel events
    window.addEventListener('novel:open-ai-selector', handleOpenAISelector as EventListener);
    window.addEventListener('novel:cancel-ai-selector', handleOpenAISelector as EventListener);
    
    return () => {
      window.removeEventListener('novel:open-ai-selector', handleOpenAISelector as EventListener);
      window.removeEventListener('novel:cancel-ai-selector', handleOpenAISelector as EventListener);
    };
  }, [onAIStateChange, editor, savedCursorPosition]);
  
  // Add a selection change listener to detect when text is selected
  useEffect(() => {
    if (!editor) return;
    
    // Function to handle selection changes
    const handleSelectionChange = () => {
      // Debounce selection events to avoid triggering too frequently
      const now = Date.now();
      if (now - lastSelectionTime < 500) return;
      setLastSelectionTime(now);
      
      // Check if there's a valid selection
      if (editor.state.selection.content().size > 0) {
        const slice = editor.state.selection.content();
        const rawContent = editor.storage.markdown.serializer.serialize(slice.content);
        const selectionContent = stripHtml(rawContent);
        
        // Only trigger if there's actual content
        if (selectionContent.trim().length > 0) {
          console.log("Selection detected:", selectionContent);
          
          // IMPORTANT: For text selection, we ONLY want to show the bubble menu
          // We NEVER want to directly open the AI selector on text selection
          
          // Only dispatch the event if we're not currently displaying an AI selector
          // This prevents selection events from affecting the UI when AI selector is open
          if (!document.querySelector('.ai-selector')) {
            // Dispatch a custom event that the bubble menu can listen for
            const event = new CustomEvent('novel:text-selected', {
              detail: {
                selectionContent,
                position: editor.state.selection.from
              }
            });
            console.log("[AI-TRIGGER-MANAGER] Dispatching novel:text-selected event with content:", 
              selectionContent.substring(0, 20) + (selectionContent.length > 20 ? '...' : ''));
            window.dispatchEvent(event);
            console.log("[AI-TRIGGER-MANAGER] Event dispatched");
          } else {
            console.log("[AI-TRIGGER-MANAGER] Selection detected, but AI selector is already open - ignoring");
          }
        }
      }
    };
    
    // Add selection change listener - properly handle the subscription
    editor.on('selectionUpdate', handleSelectionChange);
    
    // Return cleanup function
    return () => {
      // Properly remove the event listener
      editor.off('selectionUpdate', handleSelectionChange);
    };
  }, [editor, lastSelectionTime, onAIStateChange]);
  
  // No UI in this component - it just handles events
  return null;
}

export default AITriggerManager; 