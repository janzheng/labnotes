import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { projectsStore, selectedProjectId, addProject, addFolder, moveProject, deleteProject, type Project, isLoading, error, isInitialized } from '@/lib/stores';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { FolderIcon, FileIcon, PlusIcon, XIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDroppable } from "@dnd-kit/core";

// -----------------------------------------------------------------------------
// DropZone Component
// A droppable area (rendered as a horizontal rule) that computes its id
// based on its parent and its index in that parent's list.
// -----------------------------------------------------------------------------
type DropZoneProps = {
  parentId: string | null;
  index: number;
  level: number;
};

const DropZone: React.FC<DropZoneProps> = ({ parentId, index, level }) => {
  // Create a droppable id that encodes the parent and the drop index.
  // For root-level items, we use "root".
  const dropzoneId = "dropzone:" + (parentId ? parentId : "root") + ":" + index;
  const { setNodeRef, isOver } = useDroppable({
    id: dropzoneId,
    data: {
      type: 'dropzone',
      parentId,
      index,
      level,
    },
  });
  return (
    <div
      ref={setNodeRef}
      id={dropzoneId}
      style={{
        height: isOver ? '2px' : '0px',
        backgroundColor: isOver ? '#3498db' : 'rgba(0, 0, 0, 0)',
        marginLeft: level * 12,
        transition: 'background-color 0.2s ease',
      }}
    />
  );
};

// -----------------------------------------------------------------------------
// ProjectItem & SortableProjectItem
// -----------------------------------------------------------------------------
type ProjectItemProps = {
  project: Project;
  level?: number;
  dragHandleProps?: any;
  onProjectClick?: (projectId: string) => void;
};

const ProjectItem: React.FC<ProjectItemProps> = ({ project, level = 0, dragHandleProps, onProjectClick }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const store = useStore(projectsStore);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else if (onProjectClick) {
      onProjectClick(project.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteProject(project.id);
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      const currentState = projectsStore.get();
      projectsStore.set({
        ...currentState,
        items: {
          ...currentState.items,
          [project.id]: {
            ...currentState.items[project.id],
            name: newName.trim()
          }
        }
      });
      setIsEditing(false);
    }
  };

  const children = project.type === 'folder' ? project.children?.map(id => store.items[id]).filter(Boolean) : [];

  return (
    <div style={{ paddingLeft: `${level * 12}px` }}>
      <SidebarMenuItem className="group/item list-none">
        <div
          {...dragHandleProps}
          className="group relative flex w-full items-center gap-2 rounded-md p-2 text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleClick}
          data-type={project.type}
          data-id={project.id}
        >
          {project.type === 'folder' ? (
            <div className="relative w-4 h-4">
              <FolderIcon size={16} className="absolute group-hover:opacity-0 transition-opacity" />
              {isExpanded ? 
                <ChevronDownIcon size={16} className="absolute opacity-0 group-hover:opacity-100 transition-opacity" /> : 
                <ChevronRightIcon size={16} className="absolute opacity-0 group-hover:opacity-100 transition-opacity" />
              }
            </div>
          ) : (
            <FileIcon size={16} />
          )}
          
          {isEditing ? (
            <form onSubmit={handleNameSubmit} className="flex-1 flex items-center" onClick={e => e.stopPropagation()}>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onBlur={handleNameSubmit}
                autoFocus
                className="relative bg-gray-50 h-8 !border-gray-400 px-2 pt-0 leading-normal baseline focus:outline-none focus:ring-0 ring-offset-0 focus:ring-offset-0 [&:focus]:ring-offset-0 [&:focus-visible]:ring-0 [&:focus-visible]:ring-offset-0"
              />
            </form>
          ) : (
            <span 
              className="flex-1 truncate cursor-pointer" 
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              {project.name}
            </span>
          )}

          <div className="flex items-center gap-1">
            <button
              className="invisible flex h-5 w-5 items-center justify-center rounded hover:bg-background/80 group-hover/item:visible"
              onClick={handleDelete}
            >
              <XIcon size={14} className="text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </div>
      </SidebarMenuItem>

      {project.type === 'folder' && children && (
        <>
          {isExpanded && (
            <div>
              {children.map((child, i) => (
                <React.Fragment key={"child-fragment-" + child.id}>
                  <DropZone parentId={project.id} index={i} level={level + 1} />
                  <SortableProjectItem 
                    key={child.id} 
                    project={child} 
                    level={level + 1} 
                    onProjectClick={onProjectClick}
                  />
                </React.Fragment>
              ))}
              <DropZone parentId={project.id} index={children.length} level={level + 1} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

const SortableProjectItem: React.FC<ProjectItemProps> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="list-none">
      <ProjectItem {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
};

// -----------------------------------------------------------------------------
// ProjectSidebar Component
// -----------------------------------------------------------------------------
export function ProjectSidebar() {
  const store = useStore(projectsStore);
  const loading = useStore(isLoading);
  const storeError = useStore(error);
  const initialized = useStore(isInitialized);
  const [isClient, setIsClient] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverLevel, setHoverLevel] = useState(0);

  // Reduced activation distance makes drag‐start a bit more lenient.
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 4,
    },
  }));

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    if (typeof event.active.id === 'string') {
      setActiveId(event.active.id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over || typeof active.id !== 'string') return;

    // If the drop target is one of our drop zones
    if (typeof over.id === "string" && over.id.startsWith("dropzone:")) {
      const parts = over.id.split(":"); // expected format "dropzone:{parentId}:{index}"
      const targetParentId = parts[1] === "root" ? null : parts[1];
      const targetIndex = parseInt(parts[2], 10);
      moveProject(active.id, targetParentId, targetIndex);
      return;
    }
    
    if (typeof over.id !== 'string') return;
    
    const activeItem = store.items[active.id];
    const overItem = store.items[over.id];
    
    if (!activeItem || !overItem) return;

    // If dropping directly onto a folder header, drop inside the folder (at index 0)
    if (overItem.type === 'folder') {
      moveProject(active.id, overItem.id, 0);
      return;
    }

    // Otherwise, drop as a sibling: get the target parent and find index of the over item.
    const targetParentId = overItem.parentId;
    const targetArray = targetParentId ? store.items[targetParentId]?.children || [] : store.rootIds;
    const targetIndex = targetArray.indexOf(over.id);
    
    if (targetIndex === -1) return;
    moveProject(active.id, targetParentId, targetIndex);
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    if (!over) return;

    // Calculate level based on dropzone or folder
    if (typeof over.id === "string" && over.id.startsWith("dropzone:")) {
      const level = over.data.current?.level || 0;
      setHoverLevel(level);
    } else {
      // If hovering over a folder, increment the level by 1
      const overItem = store.items[over.id];
      if (overItem?.type === 'folder') {
        const baseLevel = overItem.parentId ? getItemLevel(overItem.parentId, store.items) : 0;
        setHoverLevel(baseLevel + 1);
      } else if (overItem) {
        const level = overItem.parentId ? getItemLevel(overItem.parentId, store.items) : 0;
        setHoverLevel(level);
      }
    }
  };

  // Helper function to calculate item level
  const getItemLevel = (itemId: string, items: Record<string, Project>): number => {
    let level = 0;
    let currentItem = items[itemId];
    while (currentItem?.parentId) {
      level++;
      currentItem = items[currentItem.parentId];
    }
    return level;
  };

  const handleAddFolder = () => {
    addFolder('New Folder');
  };

  const handleAddProject = () => {
    addProject('New Project');
  };

  const handleProjectClick = (projectId: string) => {
    selectedProjectId.set(projectId);
  };

  const renderContent = () => {
    if (!initialized) {
      return (
        <SidebarGroup>
          <div className="p-4">
            <p className="text-sm">Initializing...</p>
          </div>
        </SidebarGroup>
      );
    }

    if (loading) {
      return (
        <SidebarGroup>
          <div className="p-4">
            <p className="text-sm">Loading...</p>
          </div>
        </SidebarGroup>
      );
    }

    if (storeError) {
      return (
        <SidebarGroup>
          <div className="p-4">
            <p className="text-sm text-red-500">Error: {storeError}</p>
          </div>
        </SidebarGroup>
      );
    }

    return (
      <SidebarGroup>
        <div className="flex items-center justify-between px-2">
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddFolder}>
              <FolderIcon size={14} />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddProject}>
              <FileIcon size={14} />
            </Button>
          </div>
        </div>
        
        {isClient ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
          >
            <div>
              {store.rootIds.map((id, i) => (
                <React.Fragment key={"root-fragment-" + id}>
                  <DropZone parentId={null} index={i} level={0} />
                  {store.items[id] && (
                    <SortableProjectItem 
                      key={id} 
                      project={store.items[id]} 
                      onProjectClick={handleProjectClick}
                    />
                  )}
                </React.Fragment>
              ))}
              <DropZone parentId={null} index={store.rootIds.length} level={0} />
            </div>

            <DragOverlay>
              {activeId && store.items[activeId] ? (
                <div className="list-none" style={{ paddingLeft: `${hoverLevel * 12}px` }}>
                  <ProjectItem 
                    project={store.items[activeId]} 
                    onProjectClick={handleProjectClick}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <SidebarMenu className="list-none [&_li]:list-none">
            {store.rootIds.map(id => (
              store.items[id] && (
                <ProjectItem 
                  key={id} 
                  project={store.items[id]} 
                  onProjectClick={handleProjectClick}
                />
              )
            ))}
          </SidebarMenu>
        )}
      </SidebarGroup>
    );
  };

  return (
    <Sidebar variant="inset">
      <SidebarContent>
        {renderContent()}
      </SidebarContent>
    </Sidebar>
  );
} 