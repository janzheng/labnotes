import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { projectsStore, selectedProjectId, addProject, addFolder, moveProject, deleteProject, type Project, isLoading, error, isInitialized, getProjectsByLastModified, isProjectsSectionCollapsed, isHistorySectionCollapsed, expandedFolders, toggleFolderExpanded, showDeleteConfirmation } from '@/lib/stores';
import {
  Sidebar,
  SidebarFooter,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { FolderIcon, FileIcon, FilePlusIcon, XIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDroppable } from "@dnd-kit/core";
import { BasicAuthButton } from '@/components/auth/BasicAuthButton';
import { DeleteConfirmationModal } from '@/components/DeleteConfirmationModal';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Initialize dayjs with the relativeTime plugin
dayjs.extend(relativeTime);

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
        height: isOver ? '2px' : '2px',
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

type FolderStates = Record<string, boolean>;

const FOLDER_STATES_KEY = 'folder-states';

const loadFolderStates = (): FolderStates => {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(FOLDER_STATES_KEY);
  return stored ? JSON.parse(stored) : {};
};

const saveFolderStates = (states: FolderStates) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FOLDER_STATES_KEY, JSON.stringify(states));
};

const ProjectItem: React.FC<ProjectItemProps> = ({ project, level = 0, dragHandleProps, onProjectClick }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const store = useStore(projectsStore);
  
  const [folderStates, setFolderStates] = useState<FolderStates>({});
  
  useEffect(() => {
    if (project.type === 'folder') {
      const states = loadFolderStates();
      setFolderStates(states);
    }
  }, [project.type]);

  const isExpanded = project.type === 'folder' ? 
    (folderStates[project.id] !== false) : // default to true if not set
    false;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.type === 'folder') {
      const newStates = {
        ...folderStates,
        [project.id]: !isExpanded
      };
      setFolderStates(newStates);
      saveFolderStates(newStates);
    } else if (onProjectClick) {
      onProjectClick(project.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    showDeleteConfirmation(project.id);
  };

  const handleAddNewPage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.type === 'folder') {
      // For folders, add a new page at the top within the folder
      const projectId = await addProject('New Project', project.id, 0);
    } else {
      // For projects, add a new page as a sibling
      const parentId = project.parentId;
      const parentChildren = parentId 
        ? store.items[parentId]?.children || []
        : store.rootIds;
      
      const index = parentChildren.indexOf(project.id);
      if (index !== -1) {
        const projectId = await addProject('New Project', parentId, index + 1);
      }
    }
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
                onFocus={(e) => e.target.select()}
                defaultClassName="file:text-foreground placeholder:text-muted-foreground selection:bg-[#B5D8FE] flex w-full min-w-0 bg-transparent text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                className="relative bg-white px-2 pt-0 leading-normal baseline focus:outline-none focus:ring-0 ring-offset-0 focus:ring-offset-0 [&:focus]:ring-offset-0 [&:focus-visible]:ring-0 [&:focus-visible]:ring-offset-0"
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
              onClick={handleAddNewPage}
              title={project.type === 'folder' ? "Add new page to folder" : "Add new page as sibling"}
            >
              <FilePlusIcon size={14} className="text-muted-foreground hover:text-foreground" />
            </button>
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
  
  // State for project renaming in history section
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  
  // Section collapse state
  const projectsCollapsed = useStore(isProjectsSectionCollapsed);
  const historyCollapsed = useStore(isHistorySectionCollapsed);

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

  const handleDragEnd = async (event: DragEndEvent) => {
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

  const handleAddFolder = async () => {
    const folderId = await addFolder('New Folder');
  };

  const handleAddProject = async () => {
    const projectId = await addProject('New Project');

  };

  const handleProjectClick = (projectId: string) => {
    selectedProjectId.set(projectId);
  };


  const handleDelete = async (projectId: string) => {
    showDeleteConfirmation(projectId);
  };

  const toggleProjectsSection = () => {
    isProjectsSectionCollapsed.set(!projectsCollapsed);
  };

  const toggleHistorySection = () => {
    isHistorySectionCollapsed.set(!historyCollapsed);
  };

  // Handler for renaming projects in history section
  const handleRenameSubmit = (e: React.FormEvent | null, projectId: string) => {
    if (e) e.preventDefault();
    
    if (editingProjectName.trim()) {
      const currentState = projectsStore.get();
      projectsStore.set({
        ...currentState,
        items: {
          ...currentState.items,
          [projectId]: {
            ...currentState.items[projectId],
            name: editingProjectName.trim()
          }
        }
      });
    }
    
    // Reset editing state
    setEditingProjectId(null);
    setEditingProjectName('');
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
      <>
        <SidebarGroup>
          <div 
            className="flex items-center justify-between px-2 cursor-pointer" 
            onClick={toggleProjectsSection}
          >
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <div className="flex gap-1 items-center">
              {!projectsCollapsed && (
                <>
                  <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleAddFolder(); }}>
                    <FolderIcon size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleAddProject(); }}>
                    <FilePlusIcon size={14} />
                  </Button>
                </>
              )}
              {projectsCollapsed ? 
                <ChevronRightIcon size={16} className="text-muted-foreground" /> : 
                <ChevronDownIcon size={16} className="text-muted-foreground" />
              }
            </div>
          </div>
          
          {!projectsCollapsed && isClient ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
            >
              <div>
                {store.rootIds.map((id, i) => (
                  <React.Fragment key={`root-fragment-${id}-${i}`}>
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
          ) : !projectsCollapsed ? (
            <SidebarMenu className="list-none [&_li]:list-none">
              {store.rootIds.map((id, i) => (
                store.items[id] && (
                  <ProjectItem 
                    key={`menu-item-${id}-${i}`}
                    project={store.items[id]} 
                    onProjectClick={handleProjectClick}
                  />
                )
              ))}
            </SidebarMenu>
          ) : null}
        </SidebarGroup>

        <SidebarGroup className={`${projectsCollapsed ? "order-2" : "mt-auto"}`}>
          <div 
            className="flex items-center justify-between px-2 cursor-pointer" 
            onClick={toggleHistorySection}
          >
            <SidebarGroupLabel>History</SidebarGroupLabel>
            <div className="flex gap-1 items-center">
              {historyCollapsed ? 
                <ChevronRightIcon size={16} className="text-muted-foreground" /> : 
                <ChevronDownIcon size={16} className="text-muted-foreground" />
              }
            </div>
          </div>
          
          {!historyCollapsed && (
            <SidebarMenu className="list-none [&_li]:list-none">
              {getProjectsByLastModified().slice(0, 10).map((project) => (
                <SidebarMenuItem key={`history-${project.id}`} className="group/item list-none">
                  <div
                    className="group relative flex w-full items-center gap-2 rounded-md p-2 text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <FileIcon size={16} />
                    <span 
                      className="flex-1 truncate cursor-pointer" 
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingProjectId(project.id);
                        setEditingProjectName(project.name);
                        debugger;
                      }}
                    >
                      {editingProjectId === project.id ? (
                        <form 
                          onSubmit={(e) => handleRenameSubmit(e, project.id)} 
                          className="flex-1 flex items-center" 
                          onClick={e => e.stopPropagation()}
                        >
                          <Input
                            value={editingProjectName}
                            onChange={e => setEditingProjectName(e.target.value)}
                            onBlur={() => handleRenameSubmit(null, project.id)}
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            defaultClassName="file:text-foreground placeholder:text-muted-foreground selection:bg-[#B5D8FE] flex w-full min-w-0 bg-transparent text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                            className="relative bg-white px-2 pt-0 leading-normal baseline focus:outline-none focus:ring-0 ring-offset-0 focus:ring-offset-0 [&:focus]:ring-offset-0 [&:focus-visible]:ring-0 [&:focus-visible]:ring-offset-0"
                          />
                        </form>
                      ) : (
                        project.name
                      )}
                    </span>
                    <div className="flex items-center">
                      <span className="text-xs text-gray-400 group-hover/item:hidden">
                        {project.lastModified ? dayjs(project.lastModified).fromNow() : 'N/A'}
                      </span>
                      <button
                        className="hidden group-hover/item:flex h-5 w-5 items-center justify-center rounded hover:bg-background/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project.id);
                        }}
                        title="Delete project"
                      >
                        <XIcon size={14} className="text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  </div>
                </SidebarMenuItem>
              ))}
              {getProjectsByLastModified().length === 0 && (
                <div className="p-2 text-sm text-gray-500">No recent projects</div>
              )}
            </SidebarMenu>
          )}
        </SidebarGroup>
      </>
    );
  };

  return (
    <Sidebar variant="">
      <DeleteConfirmationModal />
      <SidebarContent className="flex flex-col h-full">
        <SidebarGroup>
          <div className="text-lg font-semibold pt-4 px-2">
            <a href="/" className="hover:text-gray-600 transition-colors">labnotes.</a>
          </div>
        </SidebarGroup>
        
        <div className="flex flex-col flex-grow">
          {/* Projects section - always at the top */}
          <SidebarGroup>
            <div 
              className="flex items-center justify-between px-2 cursor-pointer" 
              onClick={toggleProjectsSection}
            >
              <SidebarGroupLabel>Projects</SidebarGroupLabel>
              <div className="flex gap-1 items-center">
                {!projectsCollapsed && (
                  <>
                    <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleAddFolder(); }}>
                      <FolderIcon size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleAddProject(); }}>
                      <FilePlusIcon size={14} />
                    </Button>
                  </>
                )}
                {projectsCollapsed ? 
                  <ChevronRightIcon size={16} className="text-muted-foreground" /> : 
                  <ChevronDownIcon size={16} className="text-muted-foreground" />
                }
              </div>
            </div>
            
            {!projectsCollapsed && isClient ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
              >
                <div>
                  {store.rootIds.map((id, i) => (
                    <React.Fragment key={`root-fragment-${id}-${i}`}>
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
            ) : !projectsCollapsed ? (
              <SidebarMenu className="list-none [&_li]:list-none">
                {store.rootIds.map((id, i) => (
                  store.items[id] && (
                    <ProjectItem 
                      key={`menu-item-${id}-${i}`}
                      project={store.items[id]} 
                      onProjectClick={handleProjectClick}
                    />
                  )
                ))}
              </SidebarMenu>
            ) : null}
          </SidebarGroup>

          {/* History section - at the top if projects is closed, otherwise at the bottom */}
          <SidebarGroup className={`${projectsCollapsed ? "order-2" : "mt-auto"}`}>
            <div 
              className="flex items-center justify-between px-2 cursor-pointer" 
              onClick={toggleHistorySection}
            >
              <SidebarGroupLabel>History</SidebarGroupLabel>
              <div className="flex gap-1 items-center">
                {historyCollapsed ? 
                  <ChevronRightIcon size={16} className="text-muted-foreground" /> : 
                  <ChevronDownIcon size={16} className="text-muted-foreground" />
                }
              </div>
            </div>
            
            {!historyCollapsed && (
              <SidebarMenu className="list-none [&_li]:list-none">
                {getProjectsByLastModified().slice(0, 10).map((project) => (
                  <SidebarMenuItem key={`history-${project.id}`} className="group/item list-none">
                    <div
                      className="group relative flex w-full items-center gap-2 rounded-md p-2 text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      onClick={() => handleProjectClick(project.id)}
                    >
                      <FileIcon size={16} />
                      <span 
                        className="flex-1 truncate cursor-pointer" 
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingProjectId(project.id);
                          setEditingProjectName(project.name);
                        }}
                      >
                        {editingProjectId === project.id ? (
                          <form 
                            onSubmit={(e) => handleRenameSubmit(e, project.id)} 
                            className="flex-1 flex items-center" 
                            onClick={e => e.stopPropagation()}
                          >
                            <Input
                              value={editingProjectName}
                              onChange={e => setEditingProjectName(e.target.value)}
                              onBlur={() => handleRenameSubmit(null, project.id)}
                              autoFocus
                              onFocus={(e) => e.target.select()}
                              defaultClassName="file:text-foreground placeholder:text-muted-foreground selection:bg-[#B5D8FE] flex w-full min-w-0 bg-transparent text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                              className="relative bg-white px-2 pt-0 leading-normal baseline focus:outline-none focus:ring-0 ring-offset-0 focus:ring-offset-0 [&:focus]:ring-offset-0 [&:focus-visible]:ring-0 [&:focus-visible]:ring-offset-0"
                            />
                          </form>
                        ) : (
                          project.name
                        )}
                      </span>
                      <div className="flex items-center">
                        <span className="text-xs text-gray-400 group-hover/item:hidden">
                          {project.lastModified ? dayjs(project.lastModified).fromNow() : 'N/A'}
                        </span>
                        <button
                          className="hidden group-hover/item:flex h-5 w-5 items-center justify-center rounded hover:bg-background/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project.id);
                          }}
                          title="Delete project"
                        >
                          <XIcon size={14} className="text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    </div>
                  </SidebarMenuItem>
                ))}
                {getProjectsByLastModified().length === 0 && (
                  <div className="p-2 text-sm text-gray-500">No recent projects</div>
                )}
              </SidebarMenu>
            )}
          </SidebarGroup>
        </div>
      </SidebarContent>
      <SidebarFooter className="space-y-2">
        <BasicAuthButton />
      </SidebarFooter>
    </Sidebar>
  );
} 