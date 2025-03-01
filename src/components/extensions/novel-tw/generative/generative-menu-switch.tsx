import React, { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { EditorBubble, removeAIHighlight, useEditor, addAIHighlight } from "@/components/extensions/novel-src";
import { Button } from "../ui/button";
import Magic from "../ui/icons/magic";
import { AISelector } from "@/components/extensions/novel-tw/generative/ai-selector";
import { createPortal } from "react-dom";
import AITriggerManager from "@/components/extensions/novel-tw/generative/ai-trigger-manager";
import tippy from 'tippy.js';

interface GenerativeMenuSwitchProps {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GenerativeMenuSwitch = ({ children, open, onOpenChange }: GenerativeMenuSwitchProps) => {
  const { editor } = useEditor();
  const [fromSlashCommand, setFromSlashCommand] = useState(false);
  const [showFloatingSelector, setShowFloatingSelector] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState({ top: 0, left: 0 });
  const [triggerSource, setTriggerSource] = useState<string | null>(null);
  const floatingSelectorRef = useRef<HTMLDivElement>(null);
  const highlightAppliedRef = useRef(false); // Track if we've applied a highlight
  const [selectedContent, setSelectedContent] = useState<string>('');
  const [aiSelectorOpen, setAiSelectorOpen] = useState(false); // Track if AI selector is open
  const [showAISelector, setShowAISelector] = useState(false); // Track whether to show AI selector in bubble menu
  const [savedCursorPosition, setSavedCursorPosition] = useState<number | null>(null);
  const [floatingTippyInstance, setFloatingTippyInstance] = useState<TippyInstance | null>(null);
  const floatingContentRef = useRef<HTMLDivElement>(null);
  const virtualReferenceElement = useRef<any>(null);
  const [currentCoords, setCurrentCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  
  // Initialize: Clear any UI state storage items on component mount
  useEffect(() => {
    // Clear any stale state from storage on initialization
    // console.log("[GENERATIVE-MENU-SWITCH] Initializing and clearing any stale UI state from storage");
    sessionStorage.removeItem('novel:ai-selector-open');
    sessionStorage.removeItem('novel:suppress-bubble-menu');
    sessionStorage.removeItem('novel:last-mod-k-trigger');
    sessionStorage.removeItem('novel:last-space-trigger');
    
    return () => {
      // Also clear on unmount
      sessionStorage.removeItem('novel:ai-selector-open');
      sessionStorage.removeItem('novel:suppress-bubble-menu');
    };
  }, []);
  
  // Listen for text selection events from the AI trigger manager
  useEffect(() => {
    const handleTextSelected = (event: CustomEvent) => {
      // console.log("[GENERATIVE-MENU-SWITCH] Received novel:text-selected event", event.detail);
      
      const { selectionContent, position } = event.detail || {};
      
      // Only process if we're not already showing the AI selector
      if (aiSelectorOpen || showFloatingSelector) {
        // console.log("[GENERATIVE-MENU-SWITCH] Ignoring selection event - AI selector already open");
        return;
      }
      
      // Store the selection content
      if (selectionContent) {
        // console.log("[GENERATIVE-MENU-SWITCH] Setting selected content:", selectionContent.substring(0, 20) + (selectionContent.length > 20 ? '...' : ''));
        setSelectedContent(selectionContent);
      }
      
      // Check if the selection is valid before showing the bubble menu
      if (!selectionContent || selectionContent.trim().length === 0) {
        // console.log("[GENERATIVE-MENU-SWITCH] Empty selection, not showing bubble menu");
        return;
      }
      
      // For text selection, we want to show the bubble menu WITHOUT the AI selector
      // Just open the bubble menu but not the AI selector
      // console.log("[GENERATIVE-MENU-SWITCH] Opening bubble menu");
      setShowAISelector(false); // Make sure AI selector isn't shown
      
      // IMPORTANT: Remove any storage items that might be preventing the bubble menu from showing
      sessionStorage.removeItem('novel:ai-selector-open');
      sessionStorage.removeItem('novel:suppress-bubble-menu');
      
      onOpenChange(true); // Show the bubble menu with the Ask AI button
      // console.log("[GENERATIVE-MENU-SWITCH] Bubble menu should be visible now - open:", true);
    };
    
    // console.log("[GENERATIVE-MENU-SWITCH] Setting up novel:text-selected event listener");
    window.addEventListener('novel:text-selected', handleTextSelected as EventListener);
    
    return () => {
      // console.log("[GENERATIVE-MENU-SWITCH] Removing novel:text-selected event listener");
      window.removeEventListener('novel:text-selected', handleTextSelected as EventListener);
    };
  }, [onOpenChange, showFloatingSelector, aiSelectorOpen]);
  
  // Handler for AI trigger manager events
  const handleAIStateChange = (isOpen: boolean, source?: string, isFloating?: boolean, position?: number, selectionContent?: string) => {
    // console.log('[GENERATIVE-MENU-SWITCH] AI state change:', { 
    //   isOpen, source, isFloating, position, 
    //   selectionContentLength: selectionContent?.length || 0,
    //   selectionContent,
    // });
    
    // Save cursor position when opening the AI selector
    if (isOpen && position !== undefined && editor) {
      setSavedCursorPosition(position);
      // console.log('[GENERATIVE-MENU-SWITCH] Saved cursor position:', position);
    }
    
    // Store the selection content
    if (selectionContent) {
      setSelectedContent(selectionContent);
    } else {
      setSelectedContent('');
    }
    
    if (isOpen) {
      setTriggerSource(source || null);
      setAiSelectorOpen(true);
      
      // Only open the AI selector for specific triggers:
      // 1. slash-command
      // 2. space-command
      // 3. mod-k
      // 4. Ask AI button click
      const shouldOpenAISelector = 
        source === 'slash-command' || 
        source === 'space-command' || 
        source === 'mod-k' || 
        source === 'button';
      
      if (isFloating && shouldOpenAISelector) {
        // Get the view
        const { view } = editor;
        if (view) {
          // Use the provided position if available, otherwise use current selection
          const positionToUse = position !== undefined ? position : view.state.selection.from;
          
          try {
            // Different positioning logic based on trigger source
            if (source === 'slash-command') {
              // For slash command: position at the end of the line where slash command was triggered
              const { state } = view;
              const safePosition = Math.min(Math.max(0, positionToUse), state.doc.content.size);
              const cursorCoords = view.coordsAtPos(safePosition);
              
              // Store coordinates for getReferenceClientRect
              setCurrentCoords({
                top: cursorCoords.top,
                left: cursorCoords.left,
                width: 0,
                height: cursorCoords.bottom - cursorCoords.top
              });
            } else {
              // For selection highlight: position at the bottom of the selection
              const { state } = view;
              const { selection } = state;
              const selectionTo = selection.to;
              
              // Get coordinates for positioning
              const selectionEndCoords = view.coordsAtPos(selectionTo);
              const selectionStartCoords = view.coordsAtPos(selection.from);
              
              // Store coordinates for getReferenceClientRect
              setCurrentCoords({
                top: selectionStartCoords.top,
                left: selectionStartCoords.left,
                width: selectionEndCoords.left - selectionStartCoords.left,
                height: selectionEndCoords.bottom - selectionStartCoords.top
              });
            }
            
            // Show floating selector
            setShowFloatingSelector(true);
            
            // Apply AI highlight to selected text if there's a selection
            if (editor && editor.state.selection.content().size > 0) {
              addAIHighlight(editor);
              highlightAppliedRef.current = true;
            }
          } catch (error) {
            console.error('Error positioning AI selector:', error);
            // Set fallback coordinates
            setCurrentCoords({
              top: 100,
              left: 100,
              width: 0,
              height: 0
            });
            setShowFloatingSelector(true);
          }
        }
      } else if (shouldOpenAISelector) {
        // Use bubble menu with AI selector
        setShowAISelector(true); // Show AI selector in bubble menu
        onOpenChange(true);
        setFromSlashCommand(source === 'slash-command');
        
        // Apply AI highlight to selected text if there's a selection
        if (editor && editor.state.selection.content().size > 0) {
          addAIHighlight(editor);
          highlightAppliedRef.current = true;
        }
      }
    } else {
      // Only remove highlights when fully closing the AI interface
      if (highlightAppliedRef.current && !showFloatingSelector && !open) {
        if (editor) {
          removeAIHighlight(editor);
          highlightAppliedRef.current = false;
        }
      }
      
      // Handle close
      setShowFloatingSelector(false);
      setAiSelectorOpen(false);
      setShowAISelector(false);
      onOpenChange(false);
      setFromSlashCommand(false);
      setTriggerSource(null);
    }
  };

  // Reset the slash command flag when menu closes
  useEffect(() => {
    if (!open) {
      setFromSlashCommand(false);
      setShowAISelector(false);
      
      // Only remove highlighting when completely closed
      if (!showFloatingSelector && highlightAppliedRef.current) {
        if (editor) {
          removeAIHighlight(editor);
          highlightAppliedRef.current = false;
          editor.commands.unsetHighlight();
        }
      }
    }
  }, [open, editor, showFloatingSelector]);

  // Create/update Tippy instance when floating selector visibility changes
  useEffect(() => {
    // Clean up existing instance first
    if (floatingTippyInstance) {
      floatingTippyInstance.destroy();
    }
    
    // Only create a new Tippy instance if we're showing the floating selector and have valid coordinates
    if (showFloatingSelector && currentCoords) {
      // Create a DOM element to attach Tippy to
      const virtualEl = document.createElement('div');
      document.body.appendChild(virtualEl);
      
      // Create an element for the content
      const contentEl = document.createElement('div');
      contentEl.className = 'ai-selector-tippy-content max-w-[350px] border border-muted bg-background shadow-xl rounded-md';
      
      // Create new Tippy instance with the proper virtual positioning approach
      const instance = tippy(virtualEl, {
        getReferenceClientRect: () => ({
          width: currentCoords.width,
          height: currentCoords.height,
          top: currentCoords.top,
          bottom: currentCoords.top + currentCoords.height,
          left: currentCoords.left,
          right: currentCoords.left + currentCoords.width,
          x: currentCoords.left,
          y: currentCoords.top
        }),
        content: contentEl,
        placement: 'bottom-start',
        appendTo: document.body,
        interactive: true,
        trigger: 'manual',
        arrow: false,
        offset: [0, 10],
        animation: 'fade',
        duration: 100,
        hideOnClick: false,
        theme: 'light',
        allowHTML: true,
        zIndex: 9999,
        popperOptions: {
          strategy: 'fixed',
          modifiers: [
            {
              name: 'flip',
              options: {
                fallbackPlacements: ['top-start', 'bottom-end', 'top-end']
              }
            },
            {
              name: 'preventOverflow',
              options: {
                boundary: 'viewport',
                padding: 8
              }
            }
          ]
        }
      });
      
      // Show the tooltip
      instance.show();
      setFloatingTippyInstance(instance);
      
      // Instead of using Tippy to mount our React component, we'll use React's createPortal
      // to render directly into the Tippy content element
      
      return () => {
        // Clean up Tippy instance and DOM element
        if (instance && instance.state && !instance.state.isDestroyed) {
          instance.destroy();
        }
        if (virtualEl.parentNode) {
          virtualEl.parentNode.removeChild(virtualEl);
        }
      };
    }
    
    return () => {
      // Clear the floating Tippy instance state when not showing
      setFloatingTippyInstance(null);
    };
  }, [showFloatingSelector, currentCoords]);

  // Handle outside clicks and escape key when floating selector is shown
  useEffect(() => {
    if (!showFloatingSelector) return;
    
    // Handle clicks outside the floating selector
    const handleOutsideClick = (event: MouseEvent) => {
      const tippyContent = document.querySelector('.tippy-content');
      
      if (
        tippyContent && 
        !tippyContent.contains(event.target as Node)
      ) {
        handleCloseFloatingSelector();
      }
    };
    
    // Handle escape key press
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseFloatingSelector();
      }
    };
    
    // Add event listeners
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);
    
    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showFloatingSelector]);

  const handleCloseFloatingSelector = () => {
    // Hide Tippy instance if it exists
    if (floatingTippyInstance && !floatingTippyInstance.state.isDestroyed) {
      floatingTippyInstance.hide();
    }
    
    setShowFloatingSelector(false);
    setAiSelectorOpen(false);
    setShowAISelector(false);
    
    // Clean up sessionStorage items
    sessionStorage.removeItem('novel:ai-selector-open');
    sessionStorage.removeItem('novel:suppress-bubble-menu');
    
    // Only remove highlight now, when completely closed
    if (highlightAppliedRef.current) {
      if (editor) {
        removeAIHighlight(editor);
        highlightAppliedRef.current = false;
        editor.commands.unsetHighlight();
      }
    }
    
    // Restore the cursor position if we have one
    if (savedCursorPosition !== null && editor) {
      // console.log('[GENERATIVE-MENU-SWITCH] Restoring cursor position:', savedCursorPosition);
      setTimeout(() => {
        // Avoid using commands.focus() without position as it can reset cursor
        editor.commands.setTextSelection(savedCursorPosition);
        editor.commands.focus();
      }, 10);
    }
    
    // Dispatch cancel event to notify other components
    const cancelEvent = new CustomEvent('novel:cancel-ai-selector', {
      detail: {
        open: false,
        source: 'cancel',
        position: savedCursorPosition
      }
    });
    window.dispatchEvent(cancelEvent);
    
    // Clear any selection content
    setSelectedContent('');
    
    // Also inform the parent component that the AI selector is closed
    onOpenChange(false);
  };

  // This useEffect ensures the AI highlight is removed when both menus are closed
  useEffect(() => {
    if (!showFloatingSelector && !open && highlightAppliedRef.current) {
      if (editor) {
        // Ensure we remove the highlight when both selectors are closed
        removeAIHighlight(editor);
        highlightAppliedRef.current = false;
        // Also reset the editor selection to fix any blue text issues
        editor.commands.focus();
        editor.commands.unsetHighlight();
      }
    }
  }, [showFloatingSelector, open, editor]);

  // Explicitly manage sessionStorage for AI selector state whenever the state changes
  useEffect(() => {
    if (aiSelectorOpen) {
      sessionStorage.setItem('novel:ai-selector-open', 'true');
    } else {
      sessionStorage.removeItem('novel:ai-selector-open');
    }
  }, [aiSelectorOpen]);

  // Explicitly manage sessionStorage for bubble menu whenever the menu state changes
  useEffect(() => {
    if (open && !showAISelector) {
      // Bubble menu is open, make sure it's not suppressed
      sessionStorage.removeItem('novel:suppress-bubble-menu');
    }
  }, [open, showAISelector]);

  // Clean up Tippy instance on component unmount
  useEffect(() => {
    return () => {
      if (floatingTippyInstance && !floatingTippyInstance.state.isDestroyed) {
        floatingTippyInstance.destroy();
      }
    };
  }, [floatingTippyInstance]);

  return (
    <>
      {/* AI Trigger Manager to handle events */}
      <AITriggerManager onAIStateChange={handleAIStateChange} />
      
      {/* Add debug messages */}
      {/* {console.log("[GENERATIVE-MENU-SWITCH] Rendering. open:", open, "showAISelector:", showAISelector)} */}
      
      {/* Regular Bubble Menu */}
      <EditorBubble
        tippyOptions={{
          placement: "bottom-start",
          duration: [100, 0], // Quick fade in, no animation out
          animation: "fade",
          onHidden: () => {
            // console.log("[GENERATIVE-MENU-SWITCH] Bubble menu hidden");
            // Don't remove highlight here, only update the menu state
            onOpenChange(false);
            
            // Don't call removeAIHighlight here as it would remove the highlighting
            // when the bubble menu closes, but we want to keep it while the AI selector is open
            
            // Only remove tiptap's default highlight
            if (editor) {
              editor.chain().unsetHighlight().run();
            }
          },
          onShow: () => {
            // console.log("[GENERATIVE-MENU-SWITCH] Bubble menu shown");
          }
        }}
        className="flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-muted bg-background shadow-xl"
      >
        {open && showAISelector && (
          <>
            {/* {console.log("[GENERATIVE-MENU-SWITCH] Rendering AI Selector in bubble menu")} */}
            <AISelector 
              open={open} 
              isFloating={true}
              onOpenChange={onOpenChange} 
              fromSlashCommand={fromSlashCommand}
              selectionContent={selectedContent} 
            />
          </>
        )}
        {(!open || !showAISelector) && (
          <>
            {/* {console.log("[GENERATIVE-MENU-SWITCH] Rendering regular bubble menu buttons")} */}
            <Fragment>
              <Button
                className="gap-1 rounded-none text-purple-500"
                variant="ghost"
                onClick={() => {
                  // console.log("[GENERATIVE-MENU-SWITCH] Ask AI button clicked");
                  
                  // Save cursor position before doing anything
                  if (editor) {
                    const cursorPos = editor.state.selection.from;
                    setSavedCursorPosition(cursorPos);
                    // console.log("[GENERATIVE-MENU-SWITCH] Saved cursor position:", cursorPos);
                  }
                  
                  // Apply AI highlight if there's a selection
                  if (editor && editor.state.selection.content().size > 0) {
                    addAIHighlight(editor);
                    highlightAppliedRef.current = true;
                  }
                  
                  // Get the selection content if any
                  let selectionContent = '';
                  if (editor && editor.state.selection.content().size > 0) {
                    const slice = editor.state.selection.content();
                    selectionContent = editor.storage.markdown.serializer.serialize(slice.content);
                  }
                  
                  // Set AI selector as open
                  setAiSelectorOpen(true);
                  
                  // Ensure sessionStorage is properly set for the bubble menu component to know
                  sessionStorage.setItem('novel:ai-selector-open', 'true');
                  sessionStorage.setItem('novel:suppress-bubble-menu', 'true');
                  
                  // Dispatch an event to open the AI selector
                  const event = new CustomEvent('novel:open-ai-selector', {
                    detail: {
                      open: true,
                      source: 'button',
                      position: editor?.state.selection.from,
                      hasSelection: editor?.state.selection.content().size > 0,
                      selectionContent
                    }
                  });
                  window.dispatchEvent(event);
                  
                  // Close the bubble menu since we're opening the AI selector
                  onOpenChange(false);
                }}
                size="sm"
                data-ai-trigger="true"
              >
                <Magic className="h-5 w-5" />
                Ask AI
              </Button>
              {children}
            </Fragment>
          </>
        )}
      </EditorBubble>

      {/* Use React createPortal to render the AI Selector directly into the DOM */}
      {showFloatingSelector && floatingTippyInstance && createPortal(
        <AISelector 
          open={true} 
          onOpenChange={handleCloseFloatingSelector} 
          fromSlashCommand={triggerSource === 'slash-command'}
          isFloating={true}
          selectionContent={selectedContent}
        />,
        document.querySelector('.ai-selector-tippy-content') || document.body
      )}
    </>
  );
};

export default GenerativeMenuSwitch;
