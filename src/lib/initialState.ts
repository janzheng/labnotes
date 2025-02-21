import type { ProjectsState } from './types';

// Initial state with default folders and projects
export const initialState: ProjectsState = {
  items: {
    'folder-1': {
      id: 'folder-1',
      name: 'Getting Started',
      parentId: null,
      type: 'folder',
      children: ['project-1', 'project-2']
    },
    'folder-2': {
      id: 'folder-2', 
      name: 'My Projects',
      parentId: null,
      type: 'folder',
      children: ['project-3', 'folder-3']
    },
    'folder-3': {
      id: 'folder-3',
      name: 'Active Projects',
      parentId: 'folder-2',
      type: 'folder',
      children: ['project-4', 'project-5']
    },
    'project-1': {
      id: 'project-1',
      name: 'Welcome Guide',
      parentId: 'folder-1',
      type: 'project',
      components: [
        {
          type: 'TypeA',
          data: {
            welcomeMessage: 'Welcome to the project system!',
            steps: ['Read the guide', 'Try creating a project', 'Explore components']
          }
        }
      ]
    },
    'project-2': {
      id: 'project-2', 
      name: 'Quick Start Tutorial',
      parentId: 'folder-1',
      type: 'project',
      components: [
        {
          type: 'TypeB',
          data: {
            tutorial: {
              title: 'Getting Started',
              sections: ['Basic Navigation', 'Creating Projects', 'Using Components']
            }
          }
        }
      ]
    },
    'project-3': {
      id: 'project-3',
      name: 'Project Ideas',
      parentId: 'folder-2',
      type: 'project',
      components: [
        {
          type: 'TypeA',
          data: {
            ideas: [
              'Build a task tracker',
              'Create a knowledge base',
              'Design a workflow system'
            ]
          }
        }
      ]
    },
    'project-4': {
      id: 'project-4',
      name: 'Current Sprint',
      parentId: 'folder-3',
      type: 'project'
    },
    'project-5': {
      id: 'project-5',
      name: 'Backlog Items',
      parentId: 'folder-3',
      type: 'project'
    }
  },
  rootIds: ['folder-1', 'folder-2']
}; 