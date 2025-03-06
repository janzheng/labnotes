/* 

  Heavily modified version of tiptap-extension-global-drag-handle

*/



import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, NodeSelection, TextSelection } from '@tiptap/pm/state';
import { Slice, Fragment } from '@tiptap/pm/model';
import * as pmView from '@tiptap/pm/view';
import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup } from '@/components/ui/command';
import { CopyIcon, CopyPlusIcon, Trash2Icon } from 'lucide-react';
import { dispatchDragEvent } from './drag-state-manager';


function logDebug(...args) {
  if (window.___novelDragHandleDebug) {
    console.log('[DRAG-HANDLE-DEBUG]', ...args);
  }
}

function getPmView() {
    try {
        return pmView;
    }
    catch (error) {
        return null;
    }
}
function serializeForClipboard(view, slice) {
    // Newer Tiptap/ProseMirror
    // @ts-ignore
    if (view && typeof view.serializeForClipboard === 'function') {
        return view.serializeForClipboard(slice);
    }
    // Older version fallback
    const proseMirrorView = getPmView();
    // @ts-ignore
    if (proseMirrorView && typeof proseMirrorView?.__serializeForClipboard === 'function') {
        // @ts-ignore
        return proseMirrorView.__serializeForClipboard(view, slice);
    }
    throw new Error('No supported clipboard serialization method found.');
}

function absoluteRect(node) {
    const data = node.getBoundingClientRect();
    const modal = node.closest('[role="dialog"]');
    if (modal && window.getComputedStyle(modal).transform !== 'none') {
        const modalRect = modal.getBoundingClientRect();
        return {
            top: data.top - modalRect.top,
            left: data.left - modalRect.left,
            width: data.width,
        };
    }
    return {
        top: data.top,
        left: data.left,
        width: data.width,
    };
}
function nodeDOMAtCoords(coords, options) {
    const selectors = [
        'li',
        'p:not(:first-child)',
        'pre',
        'blockquote',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        ...options.customNodes.map((node) => `[data-type=${node}]`),
    ].join(', ');
    return document
        .elementsFromPoint(coords.x, coords.y)
        .find((elem) => elem.parentElement?.matches?.('.ProseMirror') ||
        elem.matches(selectors));
}
function nodePosAtDOM(node, view, options) {
    const boundingRect = node.getBoundingClientRect();
    return view.posAtCoords({
        left: boundingRect.left + 50 + options.dragHandleWidth,
        top: boundingRect.top + 1,
    })?.inside;
}
function calcNodePos(pos, view) {
    const $pos = view.state.doc.resolve(pos);
    if ($pos.depth > 1)
        return $pos.before($pos.depth);
    return pos;
}
function DragHandlePlugin(options) {
    logDebug('Creating DragHandlePlugin with options:', options);
    
    let listType = '';
    let hideTimeout = null;
    
    function handleDragStart(event, view) {
        view.focus();
        if (!event.dataTransfer)
            return;
        const node = nodeDOMAtCoords({
            x: event.clientX + 50 + options.dragHandleWidth,
            y: event.clientY,
        }, options);
        if (!(node instanceof Element))
            return;
        let draggedNodePos = nodePosAtDOM(node, view, options);
        if (draggedNodePos == null || draggedNodePos < 0)
            return;
        draggedNodePos = calcNodePos(draggedNodePos, view);
        const { from, to } = view.state.selection;
        const diff = from - to;
        const fromSelectionPos = calcNodePos(from, view);
        let differentNodeSelected = false;
        const nodePos = view.state.doc.resolve(fromSelectionPos);
        // Check if nodePos points to the top level node
        if (nodePos.node().type.name === 'doc')
            differentNodeSelected = true;
        else {
            const nodeSelection = NodeSelection.create(view.state.doc, nodePos.before());
            // Check if the node where the drag event started is part of the current selection
            differentNodeSelected = !(draggedNodePos + 1 >= nodeSelection.$from.pos &&
                draggedNodePos <= nodeSelection.$to.pos);
        }
        let selection = view.state.selection;
        if (!differentNodeSelected &&
            diff !== 0 &&
            !(view.state.selection instanceof NodeSelection)) {
            const endSelection = NodeSelection.create(view.state.doc, to - 1);
            selection = TextSelection.create(view.state.doc, draggedNodePos, endSelection.$to.pos);
        }
        else {
            selection = NodeSelection.create(view.state.doc, draggedNodePos);
            // if inline node is selected, e.g mention -> go to the parent node to select the whole node
            // if table row is selected, go to the parent node to select the whole node
            if (selection.node.type.isInline ||
                selection.node.type.name === 'tableRow') {
                let $pos = view.state.doc.resolve(selection.from);
                selection = NodeSelection.create(view.state.doc, $pos.before());
            }
        }
        view.dispatch(view.state.tr.setSelection(selection));
        // If the selected node is a list item, we need to save the type of the wrapping list e.g. OL or UL
        if (view.state.selection instanceof NodeSelection &&
            view.state.selection.node.type.name === 'listItem') {
            listType = node.parentElement.tagName;
        }
        const slice = view.state.selection.content();
        const { dom, text } = serializeForClipboard(view, slice);
        event.dataTransfer.clearData();
        event.dataTransfer.setData('text/html', dom.innerHTML);
        event.dataTransfer.setData('text/plain', text);
        event.dataTransfer.effectAllowed = 'copyMove';
        event.dataTransfer.setDragImage(node, 0, 0);
        view.dragging = { slice, move: event.ctrlKey };
        
        // Dispatch our universal drag event
        dispatchDragEvent('dragstart', draggedNodePos);
    }
    let dragHandleElement = null;
    let commandsVisible = false;
    let selectedNodePos = null;
    let reactRoot = null;
    
    function hideDragHandle() {
        if (dragHandleElement) {
            if (commandsVisible) {
                // Don't hide immediately if commands are visible
                return;
            }
            dragHandleElement.classList.add('hide');
            hideCommands();
        }
    }
    
    function showDragHandle() {
        if (dragHandleElement) {
            dragHandleElement.classList.remove('hide');
        }
    }
    
    // Add delay to hide commands
    function delayedHideCommands() {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        
        hideTimeout = setTimeout(() => {
            hideCommands();
        }, 300); // 300ms delay before hiding
    }
    
    function cancelHideCommands() {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    }
    
    function showCommands(view, pos) {
        logDebug('showCommands called with position:', pos);
        if (!dragHandleElement) {
            logDebug('No drag handle element found, aborting');
            return;
        }
        
        // Store the position both in local variable and as a global reference
        selectedNodePos = pos;
        window.___selectedNodePos = pos;
        
        logDebug('Selected node position set to:', selectedNodePos);
        commandsVisible = true;
        
        logDebug('Cleaning up existing commands');
        hideCommands();
        
        // Create a container for both the hit area and the commands
        const containerWrapper = document.createElement('div');
        containerWrapper.className = 'drag-handle-commands-wrapper';
        // Store the position as a data attribute for more reliable access
        containerWrapper.dataset.nodePos = String(pos);
        document.body.appendChild(containerWrapper);
        
        // Create an invisible hit area that's larger than the visible command menu
        const hitArea = document.createElement('div');
        hitArea.className = 'drag-handle-hit-area';
        containerWrapper.appendChild(hitArea);
        
        // Create the actual command container
        const commandsContainer = document.createElement('div');
        commandsContainer.className = 'drag-handle-commands';
        // Also store position on the actual command container
        commandsContainer.dataset.nodePos = String(pos);
        containerWrapper.appendChild(commandsContainer);
        
        logDebug('Command container created with position data:', pos);
        
        const DragHandleCommands = () => {
            // Create local state to store position within the React component
            const [localNodePos] = React.useState(pos);
            const [inputValue, setInputValue] = React.useState('');
            
            // Define commands within component scope with position closure
            const executeCommand = (command) => {
                // Get position from multiple possible sources for reliability
                const nodePos = localNodePos || 
                                selectedNodePos || 
                                window.___selectedNodePos || 
                                parseInt(containerWrapper.dataset.nodePos, 10);
                
                logDebug(`Executing ${command} command with position:`, nodePos);
                
                if (nodePos === null || nodePos === undefined || isNaN(nodePos)) {
                    logDebug(`No valid position for ${command} command, aborting`);
                    return;
                }
                
                const editor = window.novelEditor;
                if (editor) {
                    logDebug(`Using global editor for ${command} command:`, editor);
                    // Dispatch event with the stored position
                    const event = new CustomEvent('novel:drag-handle-command', {
                        detail: { command, position: nodePos }
                    });
                    logDebug('Dispatching event:', event);
                    window.dispatchEvent(event);
                } else {
                    logDebug(`No global editor found for ${command}, using local view`);
                    // Fallback implementation with the stored position
                    handleCommandWithView(command, view, nodePos);
                }
                
                // Hide commands after executing
                window.setTimeout(() => hideCommands(), 50);
            };
            
            // Handle backspace key in empty input to delete the block
            const handleKeyDown = (e) => {
              console.log('handleKeyDown', e.key, inputValue);  
                if (e.key === 'Backspace' && inputValue === '') {
                    logDebug('Backspace pressed in empty input, triggering delete');
                    e.preventDefault();
                    executeCommand('delete');
                }
            };
            
            // Helper function for view-based command handling
            const handleCommandWithView = (command, view, pos) => {
                if (!view || pos === null) return;
                
                try {
                    const nodeSelection = NodeSelection.create(view.state.doc, pos);
                    view.dispatch(view.state.tr.setSelection(nodeSelection));
                    
                    if (command === 'copy') {
                        const slice = view.state.selection.content();
                        const { dom, text } = serializeForClipboard(view, slice);
                        navigator.clipboard.writeText(text);
                        // Try HTML copy too
                        try {
                            navigator.clipboard.writeItem(new ClipboardItem({
                                'text/html': new Blob([dom.innerHTML], { type: 'text/html' })
                            }));
                        } catch (e) {
                            // Fallback
                            document.execCommand('copy');
                        }
                    } else if (command === 'duplicate') {
                        const slice = view.state.selection.content();
                        const tr = view.state.tr;
                        tr.insert(nodeSelection.to, slice.content);
                        view.dispatch(tr);
                    } else if (command === 'delete') {
                        view.dispatch(view.state.tr.deleteSelection());
                    }
                } catch (error) {
                    logDebug(`Error executing ${command} with view:`, error);
                }
            };
            
            return (
                <Command className="drag-handle-command">
                    <CommandInput
                        placeholder="Command..."
                        value={inputValue}
                        onValueChange={setInputValue}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none"
                    />
                    <CommandList>
                        <CommandGroup heading="Actions">
                            <CommandItem 
                                onSelect={() => executeCommand('copy')}
                                className="cursor-pointer"
                            >
                                <CopyIcon className="mr-2 h-4 w-4" />
                                <span>Copy to Clipboard</span>
                            </CommandItem>
                            <CommandItem 
                                onSelect={() => executeCommand('duplicate')}
                                className="cursor-pointer"
                            >
                                <CopyPlusIcon className="mr-2 h-4 w-4" />
                                <span>Duplicate</span>
                            </CommandItem>
                        </CommandGroup>
                        
                        {/* Separator */}
                        <div className="mx-2 my-1 h-px bg-border/50" />
                        
                        <CommandGroup>
                            <CommandItem 
                                onSelect={() => executeCommand('delete')}
                                className="text-red-500 hover:text-red-600 cursor-pointer"
                            >
                                <Trash2Icon className="mr-2 h-4 w-4 text-red-500" />
                                <span>Delete</span>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            );
        };
        
        // Create a React root using the modern API
        logDebug('Creating React root');
        reactRoot = ReactDOM.createRoot(commandsContainer);
        reactRoot.render(<DragHandleCommands />);
        
        // Position the commands
        if (dragHandleElement && commandsContainer) {
            logDebug('Positioning command container');
            const handleRect = dragHandleElement.getBoundingClientRect();
            
            // Account for scroll position for absolute positioning relative to document
            const scrollX = window.scrollX || document.documentElement.scrollLeft;
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            
            // Position directly under the drag handle
            containerWrapper.style.position = 'absolute';
            containerWrapper.style.zIndex = '999';
            containerWrapper.style.left = `${handleRect.left + scrollX - 20}px`; // Extend 20px to the left
            containerWrapper.style.top = `${handleRect.bottom + scrollY - 10}px`; // Start 10px higher
            
            // Size and position the hit area to be larger than the commands
            hitArea.style.position = 'absolute';
            hitArea.style.left = '0';
            hitArea.style.top = '0';
            hitArea.style.width = '260px'; // 40px wider than the command menu
            hitArea.style.height = '400px'; // Tall enough to cover command menu and more
            hitArea.style.backgroundColor = 'transparent';
            hitArea.style.zIndex = '1';
            
            // Position the commands container inside the wrapper
            commandsContainer.style.position = 'absolute';
            commandsContainer.style.left = '20px'; // Offset from the wrapper
            commandsContainer.style.top = '10px'; // Offset from the wrapper
            commandsContainer.style.width = '220px';
            commandsContainer.style.maxWidth = '100vw';
            commandsContainer.style.overflow = 'hidden';
            commandsContainer.style.background = 'var(--background, white)';
            commandsContainer.style.borderRadius = '6px';
            commandsContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
            commandsContainer.style.zIndex = '2'; // Above the hit area
        }
        
        // Add mouse events to prevent hiding
        containerWrapper.addEventListener('mouseenter', () => {
            logDebug('Mouse entered container wrapper');
            cancelHideCommands();
        });
        containerWrapper.addEventListener('mouseleave', (e) => {
            logDebug('Mouse left container wrapper');
            // Check if moving toward drag handle
            const rect = dragHandleElement.getBoundingClientRect();
            if (!(e.clientX >= rect.left && e.clientX <= rect.right && 
                e.clientY >= rect.top && e.clientY <= rect.bottom)) {
                delayedHideCommands();
            }
        });
    }
    
    function hideCommands() {
        logDebug('hideCommands called');
        if (hideTimeout) {
            logDebug('Clearing hide timeout');
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
        
        // Don't clear selectedNodePos until after commands are processed
        // (moving this to the end of the function)
        
        const containerWrapper = document.querySelector('.drag-handle-commands-wrapper');
        if (containerWrapper) {
            logDebug('Found container wrapper, removing');
            // Unmount React component
            if (reactRoot) {
                logDebug('Unmounting React root');
                reactRoot.unmount();
                reactRoot = null;
            }
            containerWrapper.remove();
            logDebug('Container wrapper removed');
        } else {
            logDebug('No container wrapper found to remove');
        }
        
        // Now it's safe to clear the position
        logDebug('Clearing positions, was:', selectedNodePos);
        commandsVisible = false;
        selectedNodePos = null;
        window.___selectedNodePos = null;
        
        // Dispatch universal drag end event
        dispatchDragEvent('dragend');
    }
    
    function hideHandleOnEditorOut(event) {
        if (commandsVisible) return; // Don't hide if commands are open
        
        if (event.target instanceof Element) {
            // Check if the relatedTarget class is still inside the editor
            const relatedTarget = event.relatedTarget;
            
            // Check if we're moving to the plus handle or commands
            if (relatedTarget?.classList.contains('plus-handle') || 
                relatedTarget?.closest?.('.plus-handle') ||
                relatedTarget?.classList.contains('drag-handle-commands') ||
                relatedTarget?.closest?.('.drag-handle-commands')) {
                return; // Don't hide drag handle
            }
            
            const isInsideEditor = relatedTarget?.classList.contains('tiptap') ||
                relatedTarget?.classList.contains('drag-handle');
            
            if (isInsideEditor)
                return;
        }
        // Use delayed hide instead of immediate hide
        delayedHideCommands();
        dragHandleElement.classList.add('hide');
    }
    return new Plugin({
        key: new PluginKey(options.pluginKey),
        view: (view) => {
            const handleBySelector = options.dragHandleSelector
                ? document.querySelector(options.dragHandleSelector)
                : null;
            dragHandleElement = handleBySelector ?? document.createElement('div');
            dragHandleElement.draggable = true;
            dragHandleElement.dataset.dragHandle = '';
            dragHandleElement.classList.add('drag-handle');
            
            function onDragHandleDragStart(e) {
                hideCommands();
                handleDragStart(e, view);
            }
            
            function onDragHandleClick(e) {
                e.stopPropagation();
                e.preventDefault();
                
                if (!commandsVisible) {
                    // Find the associated node by looking at a point to the right of the drag handle
                    const handleRect = dragHandleElement.getBoundingClientRect();
                    const node = nodeDOMAtCoords({
                        x: handleRect.right + 5,
                        y: handleRect.top + (handleRect.height / 2),
                    }, options);
                    
                    if (!(node instanceof Element)) return;
                    
                    let pos = nodePosAtDOM(node, view, options);
                    if (pos == null || pos < 0) return;
                    
                    pos = calcNodePos(pos, view);
                    
                    // Important: Don't hide the drag handle
                    showDragHandle();
                    
                    // Show commands
                    showCommands(view, pos);
                } else {
                    hideCommands();
                }
            }
            
            dragHandleElement.addEventListener('dragstart', onDragHandleDragStart);
            dragHandleElement.addEventListener('click', onDragHandleClick);
            
            function onDragHandleDrag(e) {
                if (!commandsVisible) {
                    hideDragHandle();
                }
                let scrollY = window.scrollY;
                if (e.clientY < options.scrollTreshold) {
                    window.scrollTo({ top: scrollY - 30, behavior: 'smooth' });
                }
                else if (window.innerHeight - e.clientY < options.scrollTreshold) {
                    window.scrollTo({ top: scrollY + 30, behavior: 'smooth' });
                }
            }
            
            dragHandleElement.addEventListener('drag', onDragHandleDrag);
            hideDragHandle();
            
            if (!handleBySelector) {
                view?.dom?.parentElement?.appendChild(dragHandleElement);
            }
            
            // Add document click handler to close commands when clicking outside
            function onDocumentClick(e) {
                if (commandsVisible && 
                    dragHandleElement && 
                    !dragHandleElement.contains(e.target) && 
                    !document.querySelector('.drag-handle-commands')?.contains(e.target)) {
                    hideCommands();
                }
            }
            
            document.addEventListener('click', onDocumentClick);
            view?.dom?.parentElement?.addEventListener('mouseout', hideHandleOnEditorOut);
            
            // Add mouseenter/mouseleave handling for the drag handle
            dragHandleElement.addEventListener('mouseenter', cancelHideCommands);
            dragHandleElement.addEventListener('mouseleave', (e) => {
                // Only trigger hide if not moving toward the commands container
                const commandsContainer = document.querySelector('.drag-handle-commands');
                if (commandsContainer) {
                    const rect = commandsContainer.getBoundingClientRect();
                    if (!(e.clientX >= rect.left && e.clientX <= rect.right && 
                          e.clientY >= rect.top && e.clientY <= rect.bottom)) {
                        delayedHideCommands();
                    }
                } else {
                    delayedHideCommands();
                }
            });
            
            return {
                destroy: () => {
                    if (!handleBySelector) {
                        dragHandleElement?.remove?.();
                    }
                    dragHandleElement?.removeEventListener('drag', onDragHandleDrag);
                    dragHandleElement?.removeEventListener('dragstart', onDragHandleDragStart);
                    dragHandleElement?.removeEventListener('click', onDragHandleClick);
                    document.removeEventListener('click', onDocumentClick);
                    dragHandleElement = null;
                    view?.dom?.parentElement?.removeEventListener('mouseout', hideHandleOnEditorOut);
                    if (hideTimeout) {
                        clearTimeout(hideTimeout);
                    }
                },
            };
        },
        props: {
            handleDOMEvents: {
                mousemove: (view, event) => {
                    if (!view.editable) {
                        return;
                    }
                    
                    
                    // Check if mouse is over plus handle - don't hide drag handle in this case
                    const isPlusHandle = event.target?.classList.contains('plus-handle') || 
                                        event.target?.closest?.('.plus-handle');
                    if (isPlusHandle) {
                        return;
                    }
                    
                    const node = nodeDOMAtCoords({
                        x: event.clientX + 50 + options.dragHandleWidth,
                        y: event.clientY,
                    }, options);
                    const notDragging = node?.closest('.not-draggable');
                    const excludedTagList = options.excludedTags
                        .concat(['ol', 'ul'])
                        .join(', ');
                    if (!(node instanceof Element) ||
                        node.matches(excludedTagList) ||
                        notDragging) {
                        hideDragHandle();
                        return;
                    }
                    const compStyle = window.getComputedStyle(node);
                    const parsedLineHeight = parseInt(compStyle.lineHeight, 10);
                    const lineHeight = isNaN(parsedLineHeight)
                        ? parseInt(compStyle.fontSize) * 1.2
                        : parsedLineHeight;
                    const paddingTop = parseInt(compStyle.paddingTop, 10);
                    const rect = absoluteRect(node);
                    rect.top += (lineHeight - 24) / 2;
                    rect.top += paddingTop;
                    // Li markers
                    if (node.matches('ul:not([data-type=taskList]) li, ol li')) {
                        rect.left -= options.dragHandleWidth;
                    }
                    rect.width = options.dragHandleWidth;
                    if (!dragHandleElement)
                        return;
                    dragHandleElement.style.left = `${rect.left - rect.width}px`;
                    dragHandleElement.style.top = `${rect.top}px`;
                    showDragHandle();
                },
                keydown: () => {
                    hideDragHandle();
                },
                mousewheel: () => {
                    hideDragHandle();
                },
                // dragging class is used for CSS
                dragstart: (view) => {
                    view.dom.classList.add('dragging');
                },
                drop: (view, event) => {
                    view.dom.classList.remove('dragging');
                    hideDragHandle();
                    let droppedNode = null;
                    const dropPos = view.posAtCoords({
                        left: event.clientX,
                        top: event.clientY,
                    });
                    if (!dropPos)
                        return;
                    if (view.state.selection instanceof NodeSelection) {
                        droppedNode = view.state.selection.node;
                    }
                    if (!droppedNode)
                        return;
                    const resolvedPos = view.state.doc.resolve(dropPos.pos);
                    const isDroppedInsideList = resolvedPos.parent.type.name === 'listItem';
                    // If the selected node is a list item and is not dropped inside a list, we need to wrap it inside <ol> tag otherwise ol list items will be transformed into ul list item when dropped
                    if (view.state.selection instanceof NodeSelection &&
                        view.state.selection.node.type.name === 'listItem' &&
                        !isDroppedInsideList &&
                        listType == 'OL') {
                        const newList = view.state.schema.nodes.orderedList?.createAndFill(null, droppedNode);
                        const slice = new Slice(Fragment.from(newList), 0, 0);
                        view.dragging = { slice, move: event.ctrlKey };
                    }
                },
                dragend: (view) => {
                    view.dom.classList.remove('dragging');
                },
            },
        },
    });
}
const GlobalDragHandle = Extension.create({
    name: 'globalDragHandle',
    addOptions() {
        logDebug('GlobalDragHandle.addOptions called');
        return {
            dragHandleWidth: 20,
            scrollTreshold: 100,
            excludedTags: [],
            customNodes: [],
            // Add custom event handlers
            onCopyToClipboard: null,
            onDuplicate: null,
            onDelete: null,
        };
    },
    addProseMirrorPlugins() {
        logDebug('GlobalDragHandle.addProseMirrorPlugins called, options:', this.options);
        return [
            DragHandlePlugin({
                pluginKey: new PluginKey('globalDragHandle'),
                dragHandleWidth: this.options.dragHandleWidth,
                scrollTreshold: this.options.scrollTreshold,
                excludedTags: this.options.excludedTags || [],
                customNodes: this.options.customNodes || [],
            }),
        ];
    },
});

export default GlobalDragHandle;
