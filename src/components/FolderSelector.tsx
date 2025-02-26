import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Plus, FolderPlus, Trash2, X, File } from 'lucide-react';
import type { Document } from '../lib/types';

interface FolderStructure {
  [key: string]: {
    files: Document[];
    subfolders: FolderStructure;
  };
}

interface FolderSelectorProps {
  folderStructure: FolderStructure;
  selectedFolder: string;
  onFolderSelect: (folder: string) => void;
  currentPath: string[];
  onPathChange: (path: string[]) => void;
  onDeleteFile: (file: Document) => void;
  onCreateFolder: (path: string[], name: string) => void;
  onDelete: (folderPath: string) => void;
}

interface ColumnProps {
  title: string;
  folders: string[];
  files: Document[];
  selectedItem: string | null;
  onSelect: (item: string) => void;
  onCreateNew: () => void;
  onDelete: (item: string) => void;
  onDeleteFile: (file: Document) => void;
  isCreating: boolean;
  onCancelCreate: () => void;
  onConfirmCreate: (name: string) => void;
  isVisible: boolean;
  level: number;
}

const Column: React.FC<ColumnProps> = ({
  title,
  folders,
  files,
  selectedItem,
  onSelect,
  onCreateNew,
  onDelete,
  onDeleteFile,
  isCreating,
  onCancelCreate,
  onConfirmCreate,
  isVisible,
  level
}) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);

  const handleCreate = () => {
    if (newFolderName.trim()) {
      onConfirmCreate(newFolderName.trim());
      setNewFolderName('');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div 
      className={`
        flex-none w-[300px] flex flex-col border-r border-gray-100
        transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-[-100%] opacity-0 absolute'}
      `}
      style={{
        left: `${level * 300}px`,
        height: '100%'
      }}
    >
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <button
          onClick={onCreateNew}
          className="btn-neumorphic-light w-8 h-8 rounded-full flex items-center justify-center text-[#f15922] hover:text-[#d14811] transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isCreating && (
          <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nouveau dossier"
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') onCancelCreate();
              }}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCreate}
                className="flex-1 px-3 py-1.5 bg-[#f15922] text-white text-sm rounded-lg hover:bg-[#d14811] transition-colors"
              >
                Créer
              </button>
              <button
                onClick={onCancelCreate}
                className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {folders.length === 0 && files.length === 0 && !isCreating ? (
          <div className="h-full flex flex-col items-center justify-center py-8 text-center">
            <FolderPlus className="text-gray-300 mb-2" size={24} />
            <p className="text-sm text-gray-400">Dossier vide</p>
            <button
              onClick={onCreateNew}
              className="mt-2 text-[#f15922] hover:text-[#d14811] text-sm"
            >
              Créer un dossier
            </button>
          </div>
        ) : (
          <>
            {folders.map((folder) => (
              <div
                key={folder}
                className={`
                  group flex items-center gap-2 rounded-lg transition-all cursor-pointer
                  ${selectedItem === folder
                    ? 'bg-[#f15922] text-white font-medium shadow-sm'
                    : 'hover:bg-gray-50 text-gray-600'
                  }
                `}
                onClick={() => onSelect(folder)}
                onMouseEnter={() => setHoveredItem(folder)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <div className="flex-1 text-left px-3 py-2 text-sm flex items-center gap-2">
                  <FolderPlus size={16} className={selectedItem === folder ? 'text-white' : 'text-gray-400'} />
                  <span className="truncate">{folder}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(folder);
                  }}
                  className={`
                    p-2 rounded-lg mr-1 transition-all duration-200
                    ${hoveredItem === folder ? 'opacity-100' : 'opacity-0'}
                    ${selectedItem === folder 
                      ? 'hover:bg-white/10 text-white' 
                      : 'hover:bg-red-50 hover:text-red-600 text-gray-400'
                    }
                  `}
                  title="Supprimer le dossier"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {files.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-2 rounded-lg transition-all hover:bg-gray-50 text-gray-600"
                onMouseEnter={() => setHoveredFile(file.id)}
                onMouseLeave={() => setHoveredFile(null)}
              >
                <div className="flex-1 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <File size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {formatFileSize(file.size)} • {new Date(file.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteFile(file)}
                  className={`
                    p-2 rounded-lg mr-1 transition-all duration-200
                    ${hoveredFile === file.id ? 'opacity-100' : 'opacity-0'}
                    hover:bg-red-50 hover:text-red-600 text-gray-400
                  `}
                  title="Supprimer le fichier"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

const FolderSelector: React.FC<FolderSelectorProps> = ({
  folderStructure,
  selectedFolder,
  onFolderSelect,
  currentPath,
  onPathChange,
  onDeleteFile,
  onCreateFolder,
  onDelete
}) => {
  const [creatingInLevel, setCreatingInLevel] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getLevelContent = (level: number): { folders: string[], files: Document[] } => {
    let current = folderStructure;
    
    if (level === 0) {
      return {
        folders: Object.keys(current).filter(k => k !== ''),
        files: current['']?.files || []
      };
    }

    for (let i = 0; i < level; i++) {
      const folder = currentPath[i];
      if (!folder || !current[folder]?.subfolders) {
        return { folders: [], files: [] };
      }
      current = current[folder].subfolders;
    }

    return {
      folders: Object.keys(current),
      files: currentPath[level] && current[currentPath[level]]
        ? current[currentPath[level]].files
        : []
    };
  };

  const handleCreateNew = (level: number, name: string) => {
    onCreateFolder([...currentPath.slice(0, level)], name);
    setCreatingInLevel(null);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => {
              onPathChange([]);
              onFolderSelect('');
            }}
            className={`hover:text-[#f15922] transition-colors ${
              currentPath.length === 0 ? 'font-medium text-[#f15922]' : ''
            }`}
          >
            IRSST
          </button>
          {currentPath.map((folder, index) => (
            <React.Fragment key={folder}>
              <ChevronRight size={14} className="text-gray-300" />
              <button
                onClick={() => {
                  const newPath = currentPath.slice(0, index + 1);
                  onPathChange(newPath);
                  onFolderSelect(newPath.join('/'));
                }}
                className={`hover:text-[#f15922] transition-colors ${
                  index === currentPath.length - 1 ? 'font-medium text-[#f15922]' : ''
                }`}
              >
                {folder}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div 
          ref={containerRef}
          className="absolute inset-0 flex transition-transform duration-300 ease-in-out"
          style={{
            transform: `translateX(-${currentPath.length * 300}px)`
          }}
        >
          {[0, 1, 2].map((level) => {
            const { folders, files } = getLevelContent(level);
            const isVisible = level <= currentPath.length;

            return (
              <Column
                key={level}
                level={level}
                isVisible={isVisible}
                title={`Niveau ${level + 1}`}
                folders={folders}
                files={files}
                selectedItem={currentPath[level] || null}
                onSelect={(folder) => {
                  const newPath = [...currentPath.slice(0, level), folder];
                  onPathChange(newPath);
                  onFolderSelect(newPath.join('/'));
                }}
                onCreateNew={() => setCreatingInLevel(level)}
                onDelete={(folder) => onDelete([...currentPath.slice(0, level), folder].join('/'))}
                onDeleteFile={onDeleteFile}
                isCreating={creatingInLevel === level}
                onCancelCreate={() => setCreatingInLevel(null)}
                onConfirmCreate={(name) => handleCreateNew(level, name)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export { FolderSelector };
export default FolderSelector;