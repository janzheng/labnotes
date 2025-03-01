import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, NodeSelection, TextSelection } from '@tiptap/pm/state';
import * as pmView from '@tiptap/pm/view';
import { addDragEventListener, type NovelDragEvent } from './drag-state-manager';


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
    left: boundingRect.left + 50 + options.handleWidth,
    top: boundingRect.top + 1,
  })?.inside;
}

function calcNodePos(pos, view) {
  const $pos = view.state.doc.resolve(pos);
  if ($pos.depth > 1)
    return $pos.before($pos.depth);
  return pos;
}

function AddLinePlugin(options) {
  let plusHandleElement = null;
  let currentNodeForHandle = null;
  let isOverHandle = false; // Track if mouse is over the handle
  let dragHandleElement: HTMLElement | null = null;
  let dragStateCleanup: (() => void) | null = null;
  let isDragging = false;

  function hidePlusHandle() {
    if (plusHandleElement && !isOverHandle) { // Only hide if not over handle
      plusHandleElement.classList.add('hide');
    }
  }

  function showPlusHandle() {
    if (plusHandleElement) {
      plusHandleElement.classList.remove('hide');

      // If we have a drag handle element, use its position to help position the plus handle
      if (dragHandleElement && dragHandleElement.style.top) {
        // This keeps the plus handle aligned with the drag handle
        const dragTop = parseInt(dragHandleElement.style.top);
        plusHandleElement.style.top = `${dragTop}px`;
      }
    }
  }

  function hideHandleOnEditorOut(event) {
    if (event.target instanceof Element) {
      const relatedTarget = event.relatedTarget;
      // Check if we're moving to the plus handle or drag handle
      if (relatedTarget === plusHandleElement ||
        relatedTarget === dragHandleElement ||
        relatedTarget?.closest?.('.drag-handle')) {
        return; // Don't clear currentNodeForHandle when moving to handles
      }
      const isInsideEditor = relatedTarget?.classList.contains('tiptap') ||
        relatedTarget?.classList.contains('drag-handle');
      if (isInsideEditor)
        return;
    }
    hidePlusHandle();
  }

  return new Plugin({
    key: new PluginKey(options.pluginKey),
    view: (view) => {
      const handleBySelector = options.handleSelector
        ? document.querySelector(options.handleSelector)
        : null;
      plusHandleElement = handleBySelector ?? document.createElement('div');
      plusHandleElement.dataset.plusHandle = '';
      plusHandleElement.classList.add('plus-handle');

      // Add plus sign icon
      plusHandleElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';

      function onPlusHandleClick(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent event bubbling

        if (!currentNodeForHandle) {
          console.warn('No current node for handle found');
          return;
        }

        let nodePos = nodePosAtDOM(currentNodeForHandle, view, options);
        if (nodePos == null || nodePos < 0) return;

        nodePos = calcNodePos(nodePos, view);

        // Create a node selection to identify where to insert
        const selection = NodeSelection.create(view.state.doc, nodePos);

        // Find the end position of the selected node
        const endPos = selection.$to.pos;

        // Try different ways to dispatch the event

        // Method 1: Using window.dispatchEvent
        const addBlockEvent1 = new CustomEvent('novel:add-block', {
          detail: {
            position: endPos
          },
          bubbles: true
        });
        window.dispatchEvent(addBlockEvent1);

        // Method 2: Using document.dispatchEvent
        const addBlockEvent2 = new CustomEvent('novel:add-block', {
          detail: {
            position: endPos
          },
          bubbles: true
        });
        document.dispatchEvent(addBlockEvent2);

        // Method 3: Direct DOM element dispatch
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
          const addBlockEvent3 = new CustomEvent('novel:add-block', {
            detail: {
              position: endPos
            },
            bubbles: true
          });
          editorElement.dispatchEvent(addBlockEvent3);
        }

        // Fallback: Direct insertion if event doesn't work
        try {
          // Insert a new paragraph after the current node
          const tr = view.state.tr;
          const paragraph = view.state.schema.nodes.paragraph.create();
          tr.insert(endPos, paragraph);

          // Set cursor to the new paragraph
          tr.setSelection(TextSelection.create(tr.doc, endPos + 1));

          view.dispatch(tr);
          view.focus();

        } catch (error) {
          console.error('Error in fallback insertion:', error);
        }
      }

      // Add mouseenter and mouseleave events to the plus handle itself
      plusHandleElement.addEventListener('mouseenter', () => {
        isOverHandle = true;
        showPlusHandle();
      });

      plusHandleElement.addEventListener('mouseleave', (e) => {
        isOverHandle = false;
        // Only hide if not moving back to the editor
        const relatedTarget = e.relatedTarget;
        const isBackToEditor = relatedTarget?.closest('.ProseMirror');
        if (!isBackToEditor) {
          hidePlusHandle();
        }
      });

      plusHandleElement.addEventListener('mouseup', onPlusHandleClick);

      hidePlusHandle();

      if (!handleBySelector) {
        view?.dom?.parentElement?.appendChild(plusHandleElement);
      }

      view?.dom?.parentElement?.addEventListener('mouseout', hideHandleOnEditorOut);

      // Find the drag handle element for checking its state
      setTimeout(() => {
        dragHandleElement = document.querySelector('.drag-handle');

        // Add a global mousedown listener to detect when dragging might start
        document.addEventListener('mousedown', (e) => {
          // Check if the mousedown is on the drag handle or its children
          if (e.target && (
            e.target === dragHandleElement ||
            (e.target instanceof Element && e.target.closest('.drag-handle'))
          )) {
            hidePlusHandle();
          }
        });

        // Add a direct observer on the drag handle to detect class changes
        if (dragHandleElement) {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                // If drag handle becomes hidden, also hide plus handle
                if (dragHandleElement && (
                  dragHandleElement.classList.contains('hide') ||
                  getComputedStyle(dragHandleElement).display === 'none'
                )) {
                  hidePlusHandle();
                }
              }
            });
          });

          observer.observe(dragHandleElement, {
            attributes: true,
            attributeFilter: ['class']
          });
        }
      }, 100);

      // Set up listener for our universal drag events
      dragStateCleanup = addDragEventListener((event: NovelDragEvent) => {
        if (event.type === 'dragstart' || event.type === 'nodedrag') {
          isDragging = true;
          hidePlusHandle();
        } else if (event.type === 'dragend' || event.type === 'drop') {
          isDragging = false;
          // Don't immediately show the handle - wait for mouse movement
        }
      });

      return {
        destroy: () => {
          if (!handleBySelector) {
            plusHandleElement?.remove?.();
          }
          plusHandleElement?.removeEventListener('click', onPlusHandleClick);
          plusHandleElement?.removeEventListener('mouseenter', () => { isOverHandle = true; showPlusHandle(); });
          plusHandleElement?.removeEventListener('mouseleave', () => { isOverHandle = false; });
          plusHandleElement = null;
          view?.dom?.parentElement?.removeEventListener('mouseout', hideHandleOnEditorOut);
          if (dragStateCleanup) {
            dragStateCleanup();
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

          // Skip processing if we're over the handle itself or if dragging
          if (isOverHandle || event.target === plusHandleElement || isDragging) {
            return;
          }

          // Use a different offset for the plus handle to avoid interference with drag handle
          const node = nodeDOMAtCoords({
            x: event.clientX + 70 + options.handleWidth, // Increased offset
            y: event.clientY,
          }, options);

          const notInteractable = node?.closest('.not-interactable');
          const excludedTagList = options.excludedTags
            .concat(['ol', 'ul'])
            .join(', ');
          if (!(node instanceof Element) ||
            node.matches(excludedTagList) ||
            notInteractable) {
            if (!isOverHandle) { // Only hide if not over handle
              hidePlusHandle();
              currentNodeForHandle = null;
            }
            return;
          }


          // Store the current node for the click handler
          currentNodeForHandle = node;

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
            rect.left -= options.handleWidth;
          }
          rect.width = options.handleWidth;
          if (!plusHandleElement)
            return;
          plusHandleElement.style.left = `${rect.left - rect.width - 20}px`; // Add extra offset
          plusHandleElement.style.top = `${rect.top}px`;
          showPlusHandle();
        },
        keydown: () => {
          if (!isOverHandle) { // Only hide if not over handle
            hidePlusHandle();
            currentNodeForHandle = null;
          }
        },
        mousewheel: () => {
          if (!isOverHandle) { // Only hide if not over handle
            hidePlusHandle();
            currentNodeForHandle = null;
          }
        },
        // Add drag event handlers
        dragstart: (view) => {
          hidePlusHandle();
          view.dom.classList.add('dragging');
        },
        drop: (view) => {
          view.dom.classList.remove('dragging');
          // Don't show handle immediately after drop
          // It will show again on next mousemove
        },
        dragend: (view) => {
          view.dom.classList.remove('dragging');
        },
      },
    },
  });
}

const AddLineHandle = Extension.create({
  name: 'addLineHandle',
  addOptions() {
    return {
      handleWidth: 20,
      scrollTreshold: 100,
      excludedTags: [],
      customNodes: [],
    };
  },
  addProseMirrorPlugins() {
    return [
      AddLinePlugin({
        pluginKey: 'addLineHandle',
        handleWidth: this.options.handleWidth,
        scrollTreshold: this.options.scrollTreshold,
        handleSelector: this.options.handleSelector,
        excludedTags: this.options.excludedTags,
        customNodes: this.options.customNodes,
      }),
    ];
  },
});

export { AddLinePlugin, AddLineHandle as default };