import React, { useEffect, useState, useRef } from 'react';
import type { ComponentConfig } from '@/lib/stores';
import projectsStore from '@/lib/stores';
import type { NovelData } from '@/lib/types';
import TailwindAdvancedEditor from '@/components/extensions/novel-tw/advanced-editor';
import type { EditorInstance } from '@/components/extensions/novel-src';
import { useSyncedComponentData, useInitialSync } from '@/lib/basicTechSync';

const Novel: React.FC<{ config: ComponentConfig }> = ({ config }) => {
  const lastSyncedContent = useRef<string>('');
  const editorRef = useRef<EditorInstance | null>(null);
  const componentIdRef = useRef<string>(`${config.projectId}-${config.componentIndex}`);
  const isInitialRender = useRef<boolean>(true);
  const skipNextUpdate = useRef<boolean>(false);
  
  // Add state for save status and word count
  const [saveStatus, setSaveStatus] = useState<string>("Saved");
  const [wordCount, setWordCount] = useState<number>(0);
  
  // Add this to track component renders
  console.log(`[NOVEL] Rendering component ${componentIdRef.current}`);
  
  // Use our sync library to handle data with optional real-time updates
  const { 
    data, 
    updateData, 
    isBasicTechActive, 
    isRealtime,
    isSyncing,
    localData
  } = useSyncedComponentData<NovelData>(
    config,
    { content: '', lastUpdated: new Date().toISOString() },
    { realtime: true }  // Enable realtime updates
  );
  
  // Handle initial sync using last-modified wins strategy
  const { 
    remoteProject, 
    syncLocalToRemote, 
    syncRemoteToLocal, 
    resolveDataConflict 
  } = useInitialSync<NovelData>(
    config,
    { content: '', lastUpdated: new Date().toISOString() },
    { realtime: false }  // Disable realtime for initial sync to prevent loops
  );
  
  // First sync on initial load - only run once
  useEffect(() => {
    if (!isBasicTechActive || !isInitialRender.current || !remoteProject) return;
    
    const currentState = projectsStore.get();
    const project = currentState.items[config.projectId];
    
    if (!project || project.type !== 'project') return;
    
    const localData = (project.components[config.componentIndex].data || { 
      content: '', 
      lastUpdated: new Date().toISOString() 
    }) as NovelData;
    
    // Set initial content reference to prevent unnecessary updates
    if (localData.content) {
      lastSyncedContent.current = localData.content;
    }
    
    // Mark initial render as complete
    isInitialRender.current = false;
    
  }, [remoteProject, isBasicTechActive]);
  
  // Add this effect to update the component ID ref when config changes
  useEffect(() => {
    componentIdRef.current = `${config.projectId}-${config.componentIndex}`;
    // Reset initial render flag when project/component changes
    isInitialRender.current = true;
  }, [config.projectId, config.componentIndex]);
  
  // Update editor content when data changes (from remote sync)
  useEffect(() => {
    // Skip if we're in the middle of our own update
    if (skipNextUpdate.current) {
      skipNextUpdate.current = false;
      return;
    }
    
    // Skip if content hasn't changed or is empty
    if (!data.content || data.content === lastSyncedContent.current) return;
    
    console.log(`[NOVEL] Content update from sync detected`);
    
    // Update the editor content directly if we have a reference to it
    if (editorRef.current && data.content) {
      try {
        const contentObj = JSON.parse(data.content);
        
        // Use our custom force update method
        if ((editorRef.current as any).forceUpdate) {
          (editorRef.current as any).forceUpdate(contentObj);
        } else {
          // Fallback to regular update
          editorRef.current.commands.setContent(contentObj, false);
        }
        
        lastSyncedContent.current = data.content;
        console.log(`[NOVEL] Editor content updated from sync`);
      } catch (error) {
        console.error('Error updating editor with content:', error);
      }
    }
  }, [data.content]);
  
  // Add this effect to force reset the editor ref when switching projects
  useEffect(() => {
    // Reset editor reference when switching projects
    return () => {
      editorRef.current = null;
      lastSyncedContent.current = '';
      isInitialRender.current = true;
    };
  }, [config.projectId, config.componentIndex]);

  const handleContentChange = async (contentJson: string, newWordCount?: number) => {
    console.log(`[NOVEL] Content change detected for ${componentIdRef.current}`);
    
    // Skip if content hasn't actually changed (prevents unnecessary syncs)
    if (contentJson === lastSyncedContent.current) {
      console.log(`[NOVEL] Skipping update - content unchanged`, contentJson);
      return;
    }
    
    // Deep compare the content objects to prevent unnecessary updates
    try {
      const newContent = JSON.parse(contentJson);
      const oldContent = lastSyncedContent.current ? JSON.parse(lastSyncedContent.current) : null;
      
      // If the content is structurally identical (just different object instances), skip update
      if (oldContent && JSON.stringify(newContent) === JSON.stringify(oldContent)) {
        console.log(`[NOVEL] Skipping update - content structurally identical`, contentJson);
        return;
      }
    } catch (error) {
      // Continue with update if parsing fails
    }
    
    console.log(`[NOVEL] Processing content change`);
    
    // Update the ref to track the latest content
    lastSyncedContent.current = contentJson;
    
    // Update save status
    setSaveStatus("Unsaved");

    // Update word count if provided
    if (newWordCount !== undefined) {
      setWordCount(newWordCount);
    }

    // Update the Novel data with the new content
    const updatedData: NovelData = {
      content: contentJson,
      lastUpdated: new Date().toISOString()
    };

    // Set flag to skip the next update triggered by our own change
    skipNextUpdate.current = true;
    
    // Update data using our sync library (handles both local and remote)
    await updateData(updatedData);
    console.log(`[NOVEL] Content updated locally and remotely`);
    
    // Set status back to saved after update
    setSaveStatus("Saved");
  };

  // Add function to copy content to clipboard
  const copyToClipboard = () => {
    try {
      if (editorRef.current) {
        // Get markdown content from the editor using the getMarkdown method
        let markdownText = '';
        
        // Try to use the getMarkdown method if available
        if (typeof (editorRef.current as any).getMarkdown === 'function') {
          markdownText = (editorRef.current as any).getMarkdown();
        } 
        // Fallback to getText if getMarkdown is not available
        else if (typeof editorRef.current.getText === 'function') {
          markdownText = editorRef.current.getText();
        }
        // Last resort fallback
        else if (editorRef.current.state && editorRef.current.state.doc) {
          markdownText = editorRef.current.state.doc.textContent;
        }
        
        if (!markdownText) {
          console.warn('Could not extract markdown from editor');
          return;
        }
        
        // Copy to clipboard
        navigator.clipboard.writeText(markdownText)
          .then(() => {
            // Show temporary success message on the button itself
            const copyButton = document.getElementById('copy-button');
            if (copyButton) {
              const originalText = copyButton.textContent;
              copyButton.textContent = "Copied!";
              setTimeout(() => {
                copyButton.textContent = originalText;
              }, 1500);
            }
          })
          .catch(err => {
            console.error('Failed to copy text: ', err);
            const copyButton = document.getElementById('copy-button');
            if (copyButton) {
              const originalText = copyButton.textContent;
              copyButton.textContent = "Copy failed";
              setTimeout(() => {
                copyButton.textContent = originalText;
              }, 1500);
            }
          });
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  return (
    <div className="space-y-4 border p-5 rounded-lg w-prose ">
      <div className="flex justify-between items-center">
        {/* Left side with status indicators */}
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg bg-accent px-2 py-1 text-muted-foreground">
            {isSyncing ? "Syncing..." : saveStatus}
          </div>
          {wordCount > 0 && (
            <div className="rounded-lg bg-accent px-2 py-1 text-muted-foreground">
              {wordCount} Words
            </div>
          )}
          {data.lastUpdated && (
            <div className="text-xs text-gray-500">
              Last saved: {new Date(data.lastUpdated).toLocaleString()}
            </div>
          )}
          <div className="text-xs text-gray-500">
            {isBasicTechActive ? "BasicTech Active" : "BasicTech Inactive"}
          </div>
          {isRealtime && (
            <div className="text-xs text-green-500">Realtime Sync {isBasicTechActive ? "Enabled" : "Disabled"}</div>
          )}
        </div>
        
        {/* Right side with copy button */}
        <button 
          id="copy-button"
          onClick={copyToClipboard}
          className="rounded-lg bg-accent px-2 py-1 text-sm text-muted-foreground hover:bg-accent/80 transition-colors cursor-pointer"
          title="Copy content to clipboard"
        >
          Copy
        </button>
      </div>
      <div className="novel-editor-container">
        <TailwindAdvancedEditor 
          key={`novel-editor-${config.projectId}-${config.componentIndex}`}
          containerClasses=""
          editorClasses=""
          defaultValue={data.content} 
          onChange={handleContentChange}
          editorRef={editorRef}
          onWordCountChange={setWordCount}
          onSaveStatusChange={setSaveStatus}
        />
      </div>
    </div>
  );
};

export default Novel; 