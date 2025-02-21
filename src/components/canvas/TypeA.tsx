import React from 'react';
import { BaseComponent, type BaseComponentProps } from './BaseComponent';

export const TypeA: React.FC<BaseComponentProps> = ({ config }) => {
  return (
    <div className="bg-blue-50 p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Type A Component</h2>
      <p>This is a Type A component with its specific layout and functionality.</p>
      <pre className="mt-2 p-2 bg-white rounded">
        {JSON.stringify(config.data, null, 2)}
      </pre>
    </div>
  );
};

export default TypeA; 