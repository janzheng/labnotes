# Project System Plan

## Objective
Create a project system that can swap out different interfaces per project, acting as a launchpad for testing new interface designs.

## Current Architecture
- **ProjectSidebar.tsx**: Manages the sidebar for the project, including drag-and-drop functionality for reordering projects and folders.
- **ProjectContainer.tsx**: Provides the layout for the project, including the sidebar and the main content area.
- **stores.ts**: Manages project data using nanostores.

## Plan

### Step 1: Create a new store for interface configurations
- **Action**: Add a new store in `src/lib/stores.ts` to manage interface configurations.
- **Details**: The store will hold the current interface configuration for each project.

### Step 2: Modify `ProjectSidebar.tsx`
- **Action**: Add functionality to select and switch interfaces for each project.
- **Details**: Update the `ProjectItem` component to include interface selection options.

### Step 3: Modify `ProjectContainer.tsx`
- **Action**: Dynamically load the selected interface component based on the interface configuration.
- **Details**: Use the new interface configuration store to determine which interface component to load.

### Step 4: Create new components for different interfaces
- **Action**: Create new components in `src/components/interfaces/` for different interface designs.
- **Details**: Create components for different interface designs and ensure they can be dynamically loaded.

## Next Steps
1. **Create a new store for interface configurations**.
2. **Modify `ProjectSidebar.tsx`**.
3. **Modify `ProjectContainer.tsx`**.
4. **Create new components for different interfaces**.