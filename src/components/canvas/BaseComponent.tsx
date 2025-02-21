import React from 'react';
import type { ComponentConfig } from '@/lib/stores';

export interface BaseComponentProps {
  config: ComponentConfig & {
    projectId: string;
    componentIndex: number;
  };
}

export const BaseComponent: React.FC<BaseComponentProps> = ({ config }) => {
  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Base Component</h2>
      <p>Component Type: {config.type}</p>
    </div>
  );
};

export default BaseComponent; 