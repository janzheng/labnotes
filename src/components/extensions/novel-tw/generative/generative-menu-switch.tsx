import { EditorBubble, removeAIHighlight, useEditor, addAIHighlight } from "@/components/extensions/novel-src";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import Magic from "../ui/icons/magic";
import { AISelector } from "@/components/extensions/novel-tw/generative/ai-selector";
import { createPortal } from "react-dom";
import AITriggerManager from "@/components/extensions/novel-tw/generative/ai-trigger-manager";

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
  
  // Handler for AI trigger manager events
  const handleAIStateChange = (isOpen: boolean, source?: string, isFloating?: boolean, position?: number, selectionContent?: string) => {
    console.log('[GENERATIVE-MENU-SWITCH] AI state change:', { 
      isOpen, source, isFloating, position, 
      selectionContentLength: selectionContent?.length || 0,
      selectionContent,
    });
    
    // Store the selection content
    if (selectionContent) {
      setSelectedContent(selectionContent);
    } else {
      setSelectedContent('');
    }
    
    if (isOpen) {
      setTriggerSource(source || null);
      
      if (isFloating) {
        // Get the view
        const { view } = editor;
        if (view) {
          // Use the provided position if available, otherwise use current selection
          const positionToUse = position !== undefined ? position : view.state.selection.from;
          console.log('Position to use:', positionToUse);
          
          try {
            // Different positioning logic based on trigger source
            if (source === 'slash-command') {
              // For slash command: position at the end of the line where slash command was triggered
              const { state } = view;
              // Ensure position is valid by clamping to document bounds
              const safePosition = Math.min(Math.max(0, positionToUse), state.doc.content.size);
              console.log('Using safe position:', safePosition);
              
              const resolvedPos = state.doc.resolve(safePosition);
              console.log('Resolved position:', {
                pos: safePosition,
                parentOffset: resolvedPos.parentOffset,
                start: resolvedPos.start(),
                end: resolvedPos.end()
              });
              
              // Get coordinates directly at the position
              const cursorCoords = view.coordsAtPos(safePosition);
              console.log('Cursor coordinates:', cursorCoords);
              
              // Set position for floating selector - use direct cursor position
              setFloatingPosition({
                top: cursorCoords.bottom,
                left: cursorCoords.left
              });
              console.log('Set floating position to:', { 
                top: cursorCoords.bottom, 
                left: cursorCoords.left 
              });
            } else {
              // For selection highlight: position at the bottom of the selection
              const { state } = view;
              const { selection } = state;
              const selectionTo = selection.to;
              
              // Get coordinates for positioning
              const selectionEndCoords = view.coordsAtPos(selectionTo);
              const selectionStartCoords = view.coordsAtPos(selection.from);
              
              setFloatingPosition({
                top: selectionEndCoords.bottom + 10, // Below the selection
                left: selectionStartCoords.left // At the start of the selection
              });
            }
            
            // Show floating selector
            setShowFloatingSelector(true);
            
            // Apply AI highlight to selected text if there's a selection
            if (editor.state.selection.content().size > 0) {
              addAIHighlight(editor);
              highlightAppliedRef.current = true;
            }
          } catch (error) {
            console.error('Error positioning AI selector:', error);
            // Fallback to a safe position if there's an error
            setFloatingPosition({
              top: 100,
              left: 100
            });
            setShowFloatingSelector(true);
          }
          
          // Mark that we've stored this timestamp in localStorage
          const now = Date.now();
          window.localStorage.setItem('novel:ai-selector-open', now.toString());
        }
      } else {
        // Use bubble menu
        onOpenChange(true);
        setFromSlashCommand(source === 'slash-command');
        
        // Apply AI highlight to selected text if there's a selection
        if (editor.state.selection.content().size > 0) {
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
      onOpenChange(false);
      setFromSlashCommand(false);
      setTriggerSource(null);
      
      // Clean up localStorage
      window.localStorage.removeItem('novel:ai-selector-open');
    }
  };

  // Reset the slash command flag when menu closes
  useEffect(() => {
    if (!open) {
      setFromSlashCommand(false);
      
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

  // Handle outside clicks and escape key when floating selector is shown
  useEffect(() => {
    if (!showFloatingSelector) return;
    
    // Handle clicks outside the floating selector
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        floatingSelectorRef.current && 
        !floatingSelectorRef.current.contains(event.target as Node)
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
    setShowFloatingSelector(false);
    
    // Clean up localStorage
    window.localStorage.removeItem('novel:ai-selector-open');
    window.localStorage.removeItem('novel:suppress-bubble-menu');
    
    // Only remove highlight now, when completely closed
    if (highlightAppliedRef.current) {
      if (editor) {
        removeAIHighlight(editor);
        highlightAppliedRef.current = false;
        editor.commands.unsetHighlight();
      }
    }
    
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

  return (
    <>
      {/* AI Trigger Manager to handle events */}
      <AITriggerManager onAIStateChange={handleAIStateChange} />
      
      {/* Regular Bubble Menu */}
      <EditorBubble
        tippyOptions={{
          placement: "bottom-start",
          duration: [100, 0], // Quick fade in, no animation out
          animation: "fade",
          onHidden: () => {
            // Don't remove highlight here, only update the menu state
            onOpenChange(false);
            
            // Don't call removeAIHighlight here as it would remove the highlighting
            // when the bubble menu closes, but we want to keep it while the AI selector is open
            
            // Only remove tiptap's default highlight
            if (editor) {
              editor.chain().unsetHighlight().run();
            }
          },
        }}
        className="flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-muted bg-background shadow-xl"
      >
        {open && <AISelector 
          open={open} 
          onOpenChange={onOpenChange} 
          fromSlashCommand={fromSlashCommand}
          selectionContent={selectedContent} 
        />}
        {!open && (
          <Fragment>
            <Button
              className="gap-1 rounded-none text-purple-500"
              variant="ghost"
              onClick={() => {
                // Apply AI highlight if there's a selection
                if (editor && editor.state.selection.content().size > 0) {
                  addAIHighlight(editor);
                  highlightAppliedRef.current = true;
                }
                
                // Use the same mechanism as other triggers
                const now = Date.now();
                window.localStorage.setItem('novel:ai-selector-open', now.toString());
                
                // Dispatch an event to open the AI selector
                const event = new CustomEvent('novel:open-ai-selector', {
                  detail: {
                    open: true,
                    timestamp: now,
                    source: 'button',
                    position: editor.state.selection.from,
                    hasSelection: editor.state.selection.content().size > 0
                  }
                });
                window.dispatchEvent(event);
              }}
              size="sm"
              data-ai-trigger="true"
            >
              <Magic className="h-5 w-5" />
              Ask AI
            </Button>
            {children}
          </Fragment>
        )}
      </EditorBubble>

      {/* Floating AI Selector */}
      {showFloatingSelector && createPortal(
        <div 
          ref={floatingSelectorRef}
          className="fixed z-[5000] w-[350px] rounded-md border border-muted bg-background shadow-xl"
          style={{ 
            top: `${floatingPosition.top}px`, 
            left: `${floatingPosition.left}px` 
          }}
        >
          <AISelector 
            open={true} 
            onOpenChange={handleCloseFloatingSelector} 
            fromSlashCommand={triggerSource === 'slash-command'}
            isFloating={true}
            selectionContent={selectedContent}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default GenerativeMenuSwitch;
