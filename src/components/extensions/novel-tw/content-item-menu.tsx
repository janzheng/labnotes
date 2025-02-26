// import { Icon } from '@/components/ui/Icon'
import { Toolbar } from '@/components/ui/toolbar'
import { Editor } from '@tiptap/react'

import { Plus, GripVertical, Clipboard, Copy, Trash2, RemoveFormatting } from 'lucide-react'

import * as Popover from '@radix-ui/react-popover'
import { Surface } from '@/components/ui/surface'
import { DropdownButton } from '@/components/ui/dropdown'
// import useContentItemActions from './hooks/useContentItemActions'
// import useData from './hooks/useData'
import { useEffect, useState, useCallback, ReactNode } from 'react'
import { Node } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'
import tippy from 'tippy.js'

console.log("Booting up ContentItemMenu [bloop]")
type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>

// Define our own interface instead of using DragHandlePluginProps
export interface DragHandleProps {
  editor: Editor
  pluginKey?: string
  tippyOptions?: Record<string, any>
  onNodeChange?: (data: {
    node: Node | null
    editor: Editor
    pos: number
  }) => void
  children: ReactNode
  className?: string
}

export const DragHandle = (props: DragHandleProps) => {
  const { editor, pluginKey = 'dragHandle', tippyOptions, onNodeChange, children } = props
  const [tippyInstance, setTippyInstance] = useState<TippyInstance | null>(null)
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef) return

    const instance = tippy(document.body, {
      trigger: 'manual',
      placement: 'left',
      arrow: false,
      offset: [0, 16],
      interactive: true,
      appendTo: () => document.body,
      content: containerRef,
      ...tippyOptions,
    })

    setTippyInstance(instance)

    return () => {
      instance.destroy()
    }
  }, [containerRef, tippyOptions])

  useEffect(() => {
    if (!editor || !tippyInstance) return

    const updateHandler = ({ editor, view, transaction }: { editor: Editor; view: any; transaction: any }) => {
      const { selection } = transaction
      const { ranges } = selection
      const from = Math.min(...ranges.map((range: any) => range.$from.pos))
      const to = Math.max(...ranges.map((range: any) => range.$to.pos))

      const node = editor.state.doc.nodeAt(from)
      const pos = from

      if (onNodeChange) {
        onNodeChange({ node, editor, pos })
      }

      // Show the drag handle when a node is selected
      if (selection instanceof NodeSelection) {
        const element = view.nodeDOM(from)
        if (element) {
          tippyInstance.setProps({
            getReferenceClientRect: () => element.getBoundingClientRect(),
          })
          tippyInstance.show()
        }
      } else {
        tippyInstance.hide()
      }
    }

    editor.on('transaction', updateHandler)

    return () => {
      editor.off('transaction', updateHandler)
    }
  }, [editor, tippyInstance, onNodeChange])

  return (
    <div ref={setContainerRef} className="drag-handle">
      {children}
    </div>
  )
}

export type ContentItemMenuProps = {
  editor: Editor
  isEditable?: boolean
}


const useContentItemActions = (editor: Editor, currentNode: Node | null, currentNodePos: number) => {
  const resetTextFormatting = useCallback(() => {
    const chain = editor.chain()

    chain.setNodeSelection(currentNodePos).unsetAllMarks()

    if (currentNode?.type.name !== 'paragraph') {
      chain.setParagraph()
    }

    chain.run()
  }, [editor, currentNodePos, currentNode?.type.name])

  const duplicateNode = useCallback(() => {
    editor.commands.setNodeSelection(currentNodePos)

    const { $anchor } = editor.state.selection
    const selectedNode = $anchor.node(1) || (editor.state.selection as NodeSelection).node

    editor
      .chain()
      .setMeta('hideDragHandle', true)
      .insertContentAt(currentNodePos + (currentNode?.nodeSize || 0), selectedNode.toJSON())
      .run()
  }, [editor, currentNodePos, currentNode?.nodeSize])

  const copyNodeToClipboard = useCallback(() => {
    editor.chain().setMeta('hideDragHandle', true).setNodeSelection(currentNodePos).run()

    document.execCommand('copy')
  }, [editor, currentNodePos])

  const deleteNode = useCallback(() => {
    editor.chain().setMeta('hideDragHandle', true).setNodeSelection(currentNodePos).deleteSelection().run()
  }, [editor, currentNodePos])

  const handleAdd = useCallback(() => {
    if (currentNodePos !== -1) {
      const currentNodeSize = currentNode?.nodeSize || 0
      const insertPos = currentNodePos + currentNodeSize
      const currentNodeIsEmptyParagraph = currentNode?.type.name === 'paragraph' && currentNode?.content?.size === 0
      const focusPos = currentNodeIsEmptyParagraph ? currentNodePos + 2 : insertPos + 2

      editor
        .chain()
        .command(({ dispatch, tr, state }) => {
          if (dispatch) {
            if (currentNodeIsEmptyParagraph) {
              tr.insertText('/', currentNodePos, currentNodePos + 1)
            } else {
              tr.insert(insertPos, state.schema.nodes.paragraph.create(null, [state.schema.text('/')]))
            }

            return dispatch(tr)
          }

          return true
        })
        .focus(focusPos)
        .run()
    }
  }, [currentNode, currentNodePos, editor])

  return {
    resetTextFormatting,
    duplicateNode,
    copyNodeToClipboard,
    deleteNode,
    handleAdd,
  }
}

export const useData = () => {
  const [currentNode, setCurrentNode] = useState<Node | null>(null)
  const [currentNodePos, setCurrentNodePos] = useState<number>(-1)

  const handleNodeChange = useCallback(
    (data: { node: Node | null; editor: Editor; pos: number }) => {
      if (data.node) {
        setCurrentNode(data.node)
      }

      setCurrentNodePos(data.pos)
    },
    [setCurrentNodePos, setCurrentNode],
  )

  return {
    currentNode,
    currentNodePos,
    setCurrentNode,
    setCurrentNodePos,
    handleNodeChange,
  }
}

export const ContentItemMenu = ({ editor, isEditable = true }: ContentItemMenuProps) => {
  console.log("Booting up ContentItemMenu", editor, isEditable);
  
  try {
    const [menuOpen, setMenuOpen] = useState(false);
    const data = useData();
    const actions = useContentItemActions(editor, data.currentNode, data.currentNodePos);

    useEffect(() => {
      console.log("ContentItemMenu mounted successfully");
      if (menuOpen) {
        editor.commands.setMeta('lockDragHandle', true);
      } else {
        editor.commands.setMeta('lockDragHandle', false);
      }
    }, [editor, menuOpen]);

    return (
      <DragHandle
        pluginKey="ContentItemMenu"
        editor={editor}
        onNodeChange={data.handleNodeChange}
        tippyOptions={{
          offset: [-2, 16],
          zIndex: 99,
        }}
      >
        {isEditable ? (
          <div className="flex items-center gap-0.5">
            <Toolbar.Button onClick={actions.handleAdd}>
              <Plus size={16} />
            </Toolbar.Button>
            <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <Popover.Trigger asChild>
                <Toolbar.Button>
                  <GripVertical size={16} />
                </Toolbar.Button>
              </Popover.Trigger>
              <Popover.Content side="bottom" align="start" sideOffset={8}>
                <Surface className="p-2 flex flex-col min-w-[16rem]">
                  <Popover.Close>
                    <DropdownButton onClick={actions.resetTextFormatting}>
                      <RemoveFormatting size={16} />
                      Clear formatting
                    </DropdownButton>
                  </Popover.Close>
                  <Popover.Close>
                    <DropdownButton onClick={actions.copyNodeToClipboard}>
                      <Clipboard size={16} />
                      Copy to clipboard
                    </DropdownButton>
                  </Popover.Close>
                  <Popover.Close>
                    <DropdownButton onClick={actions.duplicateNode}>
                      <Copy size={16} />
                      Duplicate
                    </DropdownButton>
                  </Popover.Close>
                  <Toolbar.Divider horizontal />
                  <Popover.Close>
                    <DropdownButton
                      onClick={actions.deleteNode}
                      className="text-red-500 bg-red-500 dark:text-red-500 hover:bg-red-500 dark:hover:text-red-500 dark:hover:bg-red-500 bg-opacity-10 hover:bg-opacity-20 dark:hover:bg-opacity-20"
                    >
                      <Trash2 size={16} />
                      Delete
                    </DropdownButton>
                  </Popover.Close>
                </Surface>
              </Popover.Content>
            </Popover.Root>
          </div>
        ) : null}
      </DragHandle>
    );
  } catch (error) {
    console.error("Error rendering ContentItemMenu:", error);
    return <div>Error rendering ContentItemMenu</div>;
  }
}
