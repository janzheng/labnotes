import { schema } from '@/basic.config';

// Type definitions for Basic API
type BasicAuthToken = string;
type BasicApiOptions = RequestInit & {
  params?: Record<string, string>;
};

/**
 * BasicAPI - Utility class for interacting with Basic.tech API
 * 
 * This class provides methods for authenticated API calls to Basic.tech,
 * including database operations for the tables defined in your schema.
 */
export class BasicAPI {
  private token: BasicAuthToken | null = null;
  private projectId: string;
  private baseUrl = 'https://api.basic.tech';

  constructor() {
    // Extract project ID from the schema
    this.projectId = schema.project_id;
    
    if (!this.projectId) {
      console.warn('BasicAPI: No project ID found in schema. API calls may fail.');
    }
  }

  /**
   * Set the authentication token for API requests
   */
  setToken(token: BasicAuthToken) {
    this.token = token;
  }

  /**
   * Get the current authentication token
   */
  getToken(): BasicAuthToken | null {
    return this.token;
  }

  /**
   * Check if the API client has a valid token
   */
  hasToken(): boolean {
    return !!this.token;
  }

  /**
   * Make an authenticated request to the Basic API
   */
  async request<T = any>(endpoint: string, options: BasicApiOptions = {}): Promise<T> {
    if (!this.token) {
      throw new Error('No auth token available. Please sign in first.');
    }

    const { params, ...fetchOptions } = options;
    
    // Build URL with query parameters if provided
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, value);
      });
      url += `?${queryParams.toString()}`;
    }

    // Set up headers with authentication
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...(fetchOptions.headers || {})
    };

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // For DELETE requests or other requests that might not return JSON
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return {} as T;
      }

      return await response.json() as T;
    } catch (error) {
      console.error('Basic API request failed', error);
      throw error;
    }
  }

  /**
   * Get all records from a table
   */
  async getTableData<T = any>(tableName: string): Promise<T[]> {
    return this.request<T[]>(`/account/${this.projectId}/db/${tableName}`);
  }

  /**
   * Get a single record by ID
   */
  async getRecord<T = any>(tableName: string, recordId: string): Promise<T> {
    return this.request<T>(`/account/${this.projectId}/db/${tableName}/${recordId}`);
  }

  /**
   * Create a new record in a table
   */
  async createRecord<T = any>(tableName: string, data: any): Promise<T> {
    return this.request<T>(`/account/${this.projectId}/db/${tableName}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Update an existing record
   */
  async updateRecord<T = any>(tableName: string, recordId: string, data: any): Promise<T> {
    return this.request<T>(`/account/${this.projectId}/db/${tableName}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete a record
   */
  async deleteRecord(tableName: string, recordId: string): Promise<void> {
    return this.request(`/account/${this.projectId}/db/${tableName}/${recordId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Query records with filters
   */
  async queryRecords<T = any>(tableName: string, query: any): Promise<T[]> {
    return this.request<T[]>(`/account/${this.projectId}/db/${tableName}/query`, {
      method: 'POST',
      body: JSON.stringify(query)
    });
  }

  /**
   * Get user information
   */
  async getUserInfo<T = any>(): Promise<T> {
    return this.request<T>('/auth/userInfo');
  }

  /**
   * Convenience methods for specific tables in your schema
   */

  // Emojis table operations
  async getEmojis() {
    return this.getTableData('emojis');
  }

  async createEmoji(value: string) {
    return this.createRecord('emojis', { value });
  }

  // Projects table operations
  async getProjects() {
    return this.getTableData('projects');
  }

  async getProject(id: string) {
    return this.getRecord('projects', id);
  }

  async createProject(localId: string, data: any) {
    return this.createRecord('projects', {
      localId,
      lastModified: Date.now(),
      data
    });
  }

  async updateProject(id: string, data: any) {
    return this.updateRecord('projects', id, {
      lastModified: Date.now(),
      data
    });
  }

  async deleteProject(id: string) {
    return this.deleteRecord('projects', id);
  }

  /**
   * Sync a local project to Basic
   * This can be used to keep local projects in sync with Basic storage
   */
  async syncProject(localId: string, projectData: any, updateId?: string) {
    try {
      // First try to find if this project exists by localId
      const results = await this.queryRecords('projects', {
        where: { localId: { eq: localId } }
      });

      // Include the update ID in metadata if provided
      const syncData = {
        lastModified: Date.now(),
        data: projectData,
        ...(updateId ? { metadata: { updateId } } : {})
      };

      if (results && results.length > 0) {
        // Project exists, update it
        const remoteId = results[0].id;
        return this.updateRecord('projects', remoteId, syncData);
      } else {
        // Project doesn't exist, create it
        return this.createRecord('projects', {
          localId,
          ...syncData
        });
      }
    } catch (error) {
      console.error('Failed to sync project', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const basicApi = new BasicAPI();

// Export a hook for React components
export function useBasicApi() {
  return basicApi;
} 