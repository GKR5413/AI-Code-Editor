import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';

interface SimpleTreeNode {
  id: string;
  name: string;
  children?: SimpleTreeNode[];
  isExpanded?: boolean;
}

const sampleData: SimpleTreeNode[] = [
  {
    id: 'src',
    name: 'src',
    children: [
      { id: 'src/components', name: 'components' },
      { id: 'src/hooks', name: 'hooks' },
      { id: 'src/pages', name: 'pages' }
    ]
  },
  {
    id: 'public',
    name: 'public',
    children: [
      { id: 'public/assets', name: 'assets' },
      { id: 'public/images', name: 'images' }
    ]
  }
];

const TreeNode: React.FC<{ 
  node: SimpleTreeNode; 
  onToggle: (id: string) => void; 
  level: number;
}> = ({ node, onToggle, level }) => {
  const hasChildren = node.children && node.children.length > 0;
  const indent = level * 20;

  return (
    <div>
      <div 
        className="flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer"
        style={{ paddingLeft: `${indent}px` }}
      >
        {/* Chevron */}
        {hasChildren && (
          <button 
            onClick={() => {
              console.log(`🖱️ SIMPLE TEST: Clicking chevron for ${node.name}`);
              onToggle(node.id);
            }}
            className="p-1 hover:bg-gray-200 rounded mr-1"
          >
            {node.isExpanded ? (
              <ChevronDown className="w-4 h-4 text-blue-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-blue-600" />
            )}
          </button>
        )}
        
        {/* Icon */}
        {hasChildren ? (
          node.isExpanded ? (
            <FolderOpen className="w-4 h-4 text-blue-500 mr-2" />
          ) : (
            <Folder className="w-4 h-4 text-blue-500 mr-2" />
          )
        ) : (
          <div className="w-4 h-4 mr-2" />
        )}
        
        {/* Name */}
        <span className={hasChildren ? 'font-medium text-blue-700' : 'text-gray-700'}>
          {node.name}
        </span>
      </div>
      
      {/* Children */}
      {hasChildren && node.isExpanded && (
        <div>
          {node.children!.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              onToggle={onToggle} 
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const SimpleTreeTest: React.FC = () => {
  const [treeData, setTreeData] = useState<SimpleTreeNode[]>(sampleData);

  const handleToggle = (nodeId: string) => {
    console.log(`🔄 SIMPLE TEST: Toggling ${nodeId}`);
    
    setTreeData(prevData => {
      const updateNode = (nodes: SimpleTreeNode[]): SimpleTreeNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            const newExpanded = !node.isExpanded;
            console.log(`📊 SIMPLE TEST: ${node.name} expanded: ${node.isExpanded} -> ${newExpanded}`);
            return { ...node, isExpanded: newExpanded };
          }
          if (node.children) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };
      
      const newData = updateNode(prevData);
      console.log('🔄 SIMPLE TEST: New tree data:', newData);
      return newData;
    });
  };

  return (
    <div className="p-4 bg-white border rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4 text-green-600">🧪 SIMPLE TREE TEST</h3>
      <p className="text-sm text-gray-600 mb-4">
        This is a minimal tree to test basic expansion. Click the chevrons ▶
      </p>
      
      <div className="border-l-2 border-green-300 pl-2">
        {treeData.map(node => (
          <TreeNode 
            key={node.id} 
            node={node} 
            onToggle={handleToggle} 
            level={0} 
          />
        ))}
      </div>

      <div className="mt-4 p-2 bg-gray-100 rounded">
        <h4 className="font-medium text-sm">Debug Info:</h4>
        <pre className="text-xs text-gray-600 mt-1">
          {JSON.stringify(treeData, null, 2)}
        </pre>
      </div>
    </div>
  );
};