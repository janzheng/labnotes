import { EditorBubble, removeAIHighlight, useEditor, addAIHighlight } from "@/components/extensions/novel-src";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import Magic from "../ui/icons/magic";
import { AISelector } from "./ai-selector";
import { createPortal } from "react-dom";

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
  const floatingSelectorRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!open) removeAIHighlight(editor);
    
    // Listen for the custom event to open the AI selector directly
    const handleOpenAISelector = (event: CustomEvent) => {
      console.log('[GENERATIVE-MENU-SWITCH] Event received:', event.detail);
      
      if (event.detail?.open) {
        // If triggered from space at beginning of block, show floating selector
        if (event.detail?.source === 'space') {
          // Get the current cursor position for placement
          const { view } = editor;
          if (view) {
            const { state } = view;
            const { selection } = state;
            const { from } = selection;
            
            // Get coordinates of cursor position
            const pos = view.coordsAtPos(from);
            
            // Set position for floating selector
            setFloatingPosition({
              top: pos.bottom + 10,
              left: pos.left
            });
            
            // Show floating selector instead of bubble menu
            setShowFloatingSelector(true);
            console.log('[GENERATIVE-MENU-SWITCH] Opening floating AI selector from space');
          }
        } else if (event.detail?.source === 'keyboard') {
          // For keyboard shortcuts (Cmd+K)
          console.log('[GENERATIVE-MENU-SWITCH] Opening from keyboard shortcut');
          
          // If there's a selection, use the bubble menu
          if (event.detail?.hasSelection) {
            console.log('[GENERATIVE-MENU-SWITCH] Has selection, using bubble menu');
            // Add highlight to make the bubble menu appear
            addAIHighlight(editor);
            onOpenChange(true);
            setFromSlashCommand(true);
          } else {
            // For no selection, use the floating selector like we do with space
            console.log('[GENERATIVE-MENU-SWITCH] No selection, using floating selector');
            
            // Get the current cursor position for placement
            const { view } = editor;
            if (view) {
              const { state } = view;
              const { selection } = state;
              const { from } = selection;
              
              // Get coordinates of cursor position
              const pos = view.coordsAtPos(from);
              
              // Set position for floating selector
              setFloatingPosition({
                top: pos.bottom + 10,
                left: pos.left
              });
              
              // Show floating selector
              setShowFloatingSelector(true);
              console.log('[GENERATIVE-MENU-SWITCH] Opening floating AI selector from keyboard');
            }
          }
        } else {
          // Regular bubble menu behavior for slash command
          console.log('[GENERATIVE-MENU-SWITCH] Setting open to true from slash command');
          onOpenChange(true);
          // Track that this opening came from slash command
          setFromSlashCommand(true);
        }
      }
    };
    
    window.addEventListener('novel:open-ai-selector', handleOpenAISelector as EventListener);
    
    return () => {
      window.removeEventListener('novel:open-ai-selector', handleOpenAISelector as EventListener);
    };
  }, [open, editor, onOpenChange]);

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseFloatingSelector();
      }
    };
    
    // Add event listeners
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    
    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showFloatingSelector]);

  // Reset the slash command flag and floating selector when menu closes
  useEffect(() => {
    if (!open) {
      setFromSlashCommand(false);
    }
  }, [open]);

  // Close the floating selector
  const handleCloseFloatingSelector = () => {
    setShowFloatingSelector(false);
    
    // Also inform the parent component that the AI selector is closed
    // This ensures the parent state is synchronized with our local state
    onOpenChange(false);
  };

  // This useEffect ensures the AI highlight is removed when showFloatingSelector changes to false
  useEffect(() => {
    if (!showFloatingSelector && editor) {
      // Ensure we remove the highlight when the selector is closed
      removeAIHighlight(editor);
      // Also reset the editor selection to fix any blue text issues
      editor.commands.focus();
      editor.commands.unsetHighlight();
    }
  }, [showFloatingSelector, editor]);

  return (
    <>
      <EditorBubble
        tippyOptions={{
          placement: "bottom-start",
          duration: [100, 0], // Quick fade in, no animation out
          animation: "fade",
          onHidden: () => {
            onOpenChange(false);
            editor.chain().unsetHighlight().run();
          },
        }}
        className="flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-muted bg-background shadow-xl"
      >
        {open && <AISelector open={open} onOpenChange={onOpenChange} fromSlashCommand={fromSlashCommand} />}
        {!open && (
          <Fragment>
            <Button
              className="gap-1 rounded-none text-purple-500"
              variant="ghost"
              onClick={() => onOpenChange(true)}
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

      {/* Floating AI Selector - shown when triggered by space at beginning of block */}
      {showFloatingSelector && createPortal(
        <div 
          ref={floatingSelectorRef}
          className="fixed z-50 w-[350px] rounded-md border border-muted bg-background shadow-xl"
          style={{ 
            top: `${floatingPosition.top}px`, 
            left: `${floatingPosition.left}px` 
          }}
        >
          <AISelector 
            open={true} 
            onOpenChange={handleCloseFloatingSelector} 
            fromSlashCommand={true}
            isFloating={true}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default GenerativeMenuSwitch;
