import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash, Save, X, FileText, AlertTriangle, FolderPlus, ChevronRight, HelpCircle, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchReportTemplates, createReportTemplate, updateReportTemplate, deleteReportTemplate, ReportTemplate } from '../lib/reportTemplateService';
import { fetchReportFolders, createReportFolder, updateReportFolder, deleteReportFolder, ReportFolder } from '../lib/reportFolderService';
import * as icons from 'lucide-react';

const iconOptions = [
  'FileText', 'FileChart', 'FileSpreadsheet', 'FileSearch', 
  'FileCode', 'FileDigit', 'PieChart', 'BarChart', 'LineChart', 
  'ScatterChart', 'AreaChart', 'BookOpen', 'Book', 'ClipboardList'
];

const typeOptions = [
  { 
    value: 'summary', 
    label: 'Résumé',
    description: 'Synthèse concise des points clés et conclusions principales',
    icon: 'FileText',
    example: '- Introduction claire et contexte\n- Points essentiels identifiés\n- Conclusions principales\n- Recommandations clés'
  },
  { 
    value: 'analysis', 
    label: 'Analyse',
    description: 'Analyse détaillée avec sections et interprétations approfondies',
    icon: 'FileSearch',
    example: '- Analyse approfondie du contenu\n- Interprétation des données\n- Implications et impacts\n- Recommandations détaillées'
  },
  { 
    value: 'comparison', 
    label: 'Comparaison',
    description: 'Mise en parallèle des similarités et différences entre documents',
    icon: 'FileSpreadsheet',
    example: '- Points communs identifiés\n- Différences significatives\n- Analyse comparative\n- Synthèse des comparaisons'
  },
  { 
    value: 'extraction', 
    label: 'Extraction',
    description: 'Extraction et structuration des données clés en format exploitable',
    icon: 'FileChart',
    example: '- Données principales extraites\n- Métriques importantes\n- Tendances identifiées\n- Visualisation des données'
  }
] as const;

function getIconComponent(iconName: string) {
  return (icons as any)[iconName] || icons.FileText;
}

interface FolderTreeItemProps {
  folder: ReportFolder;
  level: number;
  selectedFolder: ReportFolder | null;
  templateCounts: Record<string, number>;
  onSelect: (folder: ReportFolder) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: ReportFolder) => void;
  onDeleteFolder: (folder: ReportFolder) => void;
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  level,
  selectedFolder,
  templateCounts,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder
}) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const [folders, setFolders] = useState<ReportFolder[]>([]);

  useEffect(() => {
    fetchReportFolders().then(setFolders);
  }, []);

  const hasChildren = folders.some(f => f.parent_id === folder.id);
  const count = templateCounts[folder.id] || 0;

  const getTotalCount = (folderId: string): number => {
    const directCount = templateCounts[folderId] || 0;
    const childFolders = folders.filter(f => f.parent_id === folderId);
    const childCount = childFolders.reduce((sum, child) => sum + getTotalCount(child.id), 0);
    return directCount + childCount;
  };

  const totalCount = getTotalCount(folder.id);

  return (
    <div className="select-none">
      <motion.div
        className={`
          flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group text-sm
          ${selectedFolder?.id === folder.id 
            ? 'bg-[#f15922] text-white' 
            : 'text-gray-700 hover:bg-[#f15922]/5 hover:text-[#f15922]'
          }
          ${level === 0 ? 'mb-0.5' : ''}
        `}
        onClick={() => onSelect(folder)}
        style={{ marginLeft: `${level * 8}px` }}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {hasChildren && (
            <motion.button
              initial={false}
              animate={{ rotate: isOpen ? 90 : 0 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
              className={`
                p-0.5 rounded transition-colors
                ${selectedFolder?.id === folder.id 
                  ? 'hover:bg-white/20 text-white' 
                  : 'text-[#dba747] hover:bg-[#dba747]/10'
                }
              `}
            >
              <ChevronRight size={14} />
            </motion.button>
          )}
          <span className="truncate text-xs">{folder.name}</span>
        </div>
        
        {totalCount > 0 && (
          <div className={`
            flex items-center gap-1 text-xs
            ${selectedFolder?.id === folder.id 
              ? 'bg-white/20 text-white' 
              : level === 0 
                ? 'bg-[#dba747]/10 text-[#dba747]' 
                : 'bg-gray-100 text-gray-500'
            }
            px-1.5 py-0.5 rounded-full font-medium transition-colors
          `}>
            {count > 0 && (
              <span className={
                selectedFolder?.id === folder.id 
                  ? 'text-white' 
                  : level === 0 
                    ? 'text-[#dba747]' 
                    : ''
              }>
                {count}
              </span>
            )}
            {count > 0 && totalCount > count && ' + '}
            {totalCount > count && (
              <span className={
                selectedFolder?.id === folder.id 
                  ? 'text-white/70' 
                  : 'text-gray-400'
              }>
                {totalCount - count}
              </span>
            )}
          </div>
        )}

        <div className={`
          flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity
          ${selectedFolder?.id === folder.id ? 'text-white' : 'text-gray-500'}
        `}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateFolder(folder.id);
            }}
            className="p-1 hover:bg-black/10 rounded"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRenameFolder(folder);
            }}
            className="p-1 hover:bg-black/10 rounded"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFolder(folder);
            }}
            className="p-1 hover:bg-black/10 rounded"
          >
            <Trash size={14} />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {folders
              .filter(f => f.parent_id === folder.id)
              .map(childFolder => (
                <FolderTreeItem
                  key={childFolder.id}
                  folder={childFolder}
                  level={level + 1}
                  selectedFolder={selectedFolder}
                  templateCounts={templateCounts}
                  onSelect={onSelect}
                  onCreateFolder={onCreateFolder}
                  onRenameFolder={onRenameFolder}
                  onDeleteFolder={onDeleteFolder}
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ReportTemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WizardStep {
  title: string;
  description: string;
  icon: keyof typeof icons;
}

const wizardSteps: WizardStep[] = [
  {
    title: "Type de Rapport",
    description: "Choisissez le type de rapport qui correspond le mieux à vos besoins",
    icon: "FileText"
  },
  {
    title: "Informations de Base",
    description: "Donnez un nom et une description à votre modèle",
    icon: "Info"
  },
  {
    title: "Structure du Rapport",
    description: "Définissez les sections et leur organisation",
    icon: "LayoutTemplate"
  },
  {
    title: "Instructions pour l'IA",
    description: "Personnalisez les instructions pour l'assistant IA",
    icon: "Brain"
  },
  {
    title: "Finalisation",
    description: "Vérifiez et confirmez les paramètres",
    icon: "CheckCircle"
  }
];

export function ReportTemplateManager({ isOpen, onClose }: ReportTemplateManagerProps) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTemplate, setCurrentTemplate] = useState<Partial<ReportTemplate> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<ReportFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<ReportFolder | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'summary' | 'analysis' | 'comparison' | 'extraction'>('all');
  const [currentStep, setCurrentStep] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      fetchReportFolders().then(setFolders);
    }
  }, [isOpen]);

  async function loadTemplates() {
    setIsLoading(true);
    try {
      const templates = await fetchReportTemplates();
      setTemplates(templates);
    } catch (error) {
      setError('Erreur lors du chargement des modèles');
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreateFolder = async (parentId: string | null) => {
    const name = window.prompt('Nom du dossier:');
    if (name) {
      const newFolder = await createReportFolder(name, parentId);
      if (newFolder) {
        setFolders([...folders, newFolder]);
      }
    }
  };

  const handleRenameFolder = async (folder: ReportFolder) => {
    const newName = window.prompt('Nouveau nom:', folder.name);
    if (newName && newName !== folder.name) {
      const updatedFolder = await updateReportFolder(folder.id, newName);
      if (updatedFolder) {
        setFolders(folders.map(f => f.id === folder.id ? updatedFolder : f));
      }
    }
  };

  const handleDeleteFolder = async (folder: ReportFolder) => {
    if (window.confirm(`Supprimer le dossier "${folder.name}" ?`)) {
      const success = await deleteReportFolder(folder.id);
      if (success) {
        setFolders(folders.filter(f => f.id !== folder.id));
        if (selectedFolder?.id === folder.id) {
          setSelectedFolder(null);
        }
      }
    }
  };

  const handleNext = () => {
    if (currentStep < wizardSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    if (!currentTemplate?.name || !currentTemplate.prompt) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    try {
      if ('id' in currentTemplate && currentTemplate.id) {
        await updateReportTemplate(currentTemplate.id, currentTemplate);
      } else {
        await createReportTemplate(currentTemplate as Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>);
      }
      
      setIsEditing(false);
      setCurrentTemplate(null);
      setCurrentStep(0);
      await loadTemplates();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setCurrentTemplate(null);
    setCurrentStep(0);
    setError(null);
  };

  // Calculate template counts per folder
  const templateCounts = folders.reduce((acc, folder) => {
    acc[folder.id] = templates.filter(t => t.folder_id === folder.id).length;
    return acc;
  }, {} as Record<string, number>);

  const renderWizardStep = () => {
    switch (currentStep) {
      case 0: // Type Selection
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-medium text-gray-900">
              Choisissez le Type de Rapport
            </h3>
            <p className="text-gray-600">
              Sélectionnez le type qui correspond le mieux à vos besoins. Chaque type est optimisé pour un objectif spécifique.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {typeOptions.map(option => {
                const Icon = getIconComponent(option.icon);
                return (
                  <div
                    key={option.value}
                    className={`
                      p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${currentTemplate?.type === option.value 
                        ? 'border-[#f15922] bg-[#f15922]/5' 
                        : 'border-gray-200 hover:border-[#f15922]/50 hover:bg-gray-50'
                      }
                    `}
                    onClick={() => setCurrentTemplate({
                      ...currentTemplate,
                      type: option.value,
                      icon: option.icon
                    })}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`
                        p-2 rounded-lg
                        ${currentTemplate?.type === option.value 
                          ? 'bg-[#f15922] text-white' 
                          : 'bg-gray-100 text-gray-600'
                        }
                      `}>
                        <Icon size={24} />
                      </div>
                      <h4 className="text-lg font-medium">{option.label}</h4>
                    </div>
                    <p className="text-gray-600 mb-3">
                      {option.description}
                    </p>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">
                        Exemple de structure :
                      </h5>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                        {option.example}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 1: // Basic Information
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-medium text-gray-900">
              Informations de Base
            </h3>
            <p className="text-gray-600">
              Donnez un nom clair et une description détaillée à votre modèle pour faciliter son identification et son utilisation.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du Modèle*
                </label>
                <input
                  type="text"
                  value={currentTemplate?.name || ''}
                  onChange={e => setCurrentTemplate({...currentTemplate!, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                  placeholder="Ex: Analyse de Risques SST"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Choisissez un nom descriptif qui reflète clairement l'objectif du modèle.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={currentTemplate?.description || ''}
                  onChange={e => setCurrentTemplate({...currentTemplate!, description: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] h-32 resize-none"
                  placeholder="Ex: Ce modèle permet d'analyser en détail les risques SST identifiés..."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Une description détaillée aide les utilisateurs à comprendre l'utilité et le contexte du modèle.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dossier
                </label>
                <select
                  value={currentTemplate?.folder_id || ''}
                  onChange={e => setCurrentTemplate({...currentTemplate!, folder_id: e.target.value || null})}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                >
                  <option value="">Sélectionnez un dossier</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Organisez vos modèles en les classant dans des dossiers thématiques.
                </p>
              </div>
            </div>
          </div>
        );

      case 2: // Structure
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-medium text-gray-900">
              Structure du Rapport
            </h3>
            <p className="text-gray-600">
              Définissez la structure de votre rapport en listant les sections. Ajoutez un astérisque (*) pour les sections obligatoires.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sections du Rapport
                </label>
                <textarea
                  value={
                    typeof currentTemplate?.structure === 'string' 
                      ? currentTemplate.structure 
                      : currentTemplate?.structure?.sections
                          ?.map(s => `${s.title}${s.required ? '*' : ''}`)
                          .join('\n') || ''
                  }
                  onChange={e => {
                    setCurrentTemplate({
                      ...currentTemplate!,
                      structure: e.target.value
                    });
                    setError(null);
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] h-96 font-mono"
                  placeholder="Introduction*
Contexte
Points Clés*
Analyse
Recommandations*
Conclusion"
                />
              </div>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Guide de Structure
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• Une section par ligne</li>
                    <li>• Ajoutez * pour les sections obligatoires</li>
                    <li>• Gardez les noms courts et descriptifs</li>
                    <li>• Organisez dans un ordre logique</li>
                  </ul>
                </div>
                <div className="bg-[#f15922]/5 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-[#f15922] mb-2">
                    Sections Recommandées
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• Introduction (contexte, objectifs)</li>
                    <li>• Méthodologie (approche, outils)</li>
                    <li>• Analyse (observations, données)</li>
                    <li>• Résultats (découvertes, implications)</li>
                    <li>• Recommandations (actions, priorités)</li>
                    <li>• Conclusion (synthèse, perspectives)</li>
                  </ul>
                </div>
                <div className="bg-[#dba747]/5 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-[#dba747] mb-2">
                    Conseils
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• Limitez-vous à 6-8 sections principales</li>
                    <li>• Commencez par une introduction claire</li>
                    <li>• Incluez une section de recommandations</li>
                    <li>• Terminez par une conclusion synthétique</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 3: // AI Instructions
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-medium text-gray-900">
              Instructions pour l'Assistant IA
            </h3>
            <p className="text-gray-600">
              Personnalisez les instructions qui guideront l'IA dans la génération de votre rapport.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt IA*
                </label>
                <textarea
                  value={currentTemplate?.prompt || ''}
                  onChange={e => setCurrentTemplate({...currentTemplate!, prompt: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] h-96 font-mono"
                  placeholder="Instructions détaillées pour l'IA..."
                />
              </div>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Guide de Rédaction du Prompt
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• Soyez précis et détaillé</li>
                    <li>• Utilisez un langage clair</li>
                    <li>• Structurez vos instructions</li>
                    <li>• Spécifiez le ton et le style</li>
                  </ul>
                </div>
                <div className="bg-[#f15922]/5 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-[#f15922] mb-2">
                    Éléments à Inclure
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• Objectif du rapport</li>
                    <li>• Format attendu</li>
                    <li>• Points d'attention particuliers</li>
                    <li>• Niveau de détail souhaité</li>
                    <li>• Style de rédaction</li>
                  </ul>
                </div>
                <div className="bg-[#dba747]/5 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-[#dba747] mb-2">
                    Exemple de Structure
                  </h4>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                    {`OBJECTIF : [Description claire de l'objectif]

STRUCTURE ATTENDUE :
1. [Section 1]
   - Point clé 1
   - Point clé 2

2. [Section 2]
   - Analyse requise
   - Éléments à inclure

CONSIGNES SPÉCIFIQUES :
- Style et ton
- Points d'attention
- Recommandations`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        );

      case 4: // Review
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-medium text-gray-900">
              Vérification Finale
            </h3>
            <p className="text-gray-600">
              Vérifiez tous les paramètres de votre modèle avant de l'enregistrer.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Informations de Base
                  </h4>
                  <dl className="space-y-2">
                    <dt className="text-sm text-gray-500">Nom</dt>
                    <dd className="text-sm font-medium text-gray-900">{currentTemplate?.name}</dd>
                    <dt className="text-sm text-gray-500">Type</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {typeOptions.find(t => t.value === currentTemplate?.type)?.label}
                    </dd>
                    <dt className="text-sm text-gray-500">Description</dt>
                    <dd className="text-sm font-medium text-gray-900">{currentTemplate?.description}</dd>
                  </dl>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Structure
                  </h4>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                    {typeof currentTemplate?.structure === 'string' 
                      ? currentTemplate.structure 
                      : currentTemplate?.structure?.sections
                          ?.map(s => `${s.title}${s.required ? '*' : ''}`)
                          .join('\n')}
                  </pre>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Instructions IA
                  </h4>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                    {currentTemplate?.prompt}
                  </pre>
                </div>
                <div className="bg-[#f15922]/5 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-[#f15922] mb-2">
                    Liste de Vérification
                  </h4>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2">
                      <Check size={16} className={currentTemplate?.name ? 'text-green-500' : 'text-gray-300'} />
                      <span className={currentTemplate?.name ? 'text-gray-900' : 'text-gray-500'}>
                        Nom du modèle défini
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={16} className={currentTemplate?.type ? 'text-green-500' : 'text-gray-300'} />
                      <span className={currentTemplate?.type ? 'text-gray-900' : 'text-gray-500'}>
                        Type de rapport sélectionné
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={16} className={currentTemplate?.structure ? 'text-green-500' : 'text-gray-300'} />
                      <span className={currentTemplate?.structure ? 'text-gray-900' : 'text-gray-500'}>
                        Structure définie
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={16} className={currentTemplate?.prompt ? 'text-green-500' : 'text-gray-300'} />
                      <span className={currentTemplate?.prompt ? 'text-gray-900' : 'text-gray-500'}>
                        Instructions IA complétées
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl mx-4 max-h-[85vh] flex flex-col">
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={24} />
            {isEditing 
              ? currentTemplate?.id 
                ? 'Modifier le Modèle de Rapport'
                : 'Nouveau Modèle de Rapport'
              : 'Gestionnaire de Modèles de Rapports'
            }
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => {
                  setCurrentTemplate({
                    name: '',
                    description: '',
                    icon: 'FileText',
                    type: 'summary',
                    prompt: '',
                    structure: '',
                    is_active: true,
                    folder_id: selectedFolder?.id || null
                  });
                  setIsEditing(true);
                  setCurrentStep(0);
                }}
                className="header-neumorphic-button px-4 py-2 rounded-lg flex items-center gap-2 text-white"
              >
                <Plus size={18} />
                <span>Nouveau modèle</span>
              </button>
            )}
            <button
              onClick={() => {
                if (isEditing) {
                  if (window.confirm('Êtes-vous sûr de vouloir annuler la création du modèle ?')) {
                    handleCancel();
                  }
                } else {
                  onClose();
                }
              }}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
              <AlertTriangle size={20} />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-700 hover:text-red-900"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-6">
              {/* Progress bar */}
              <div className="relative">
                <div className="absolute top-2 left-0 w-full h-0.5 bg-gray-200">
                  <div 
                    className="absolute top-0 left-0 h-full bg-[#f15922] transition-all duration-300"
                    style={{ width: `${(currentStep / (wizardSteps.length - 1)) * 100}%` }}
                  />
                </div>
                <div className="relative flex justify-between">
                  {wizardSteps.map((step, index) => {
                    const Icon = getIconComponent(step.icon);
                    return (
                      <div 
                        key={index}
                        className="flex flex-col items-center"
                        style={{ width: '120px' }}
                      >
                        <div 
                          className={`
                            w-10 h-10 rounded-full flex items-center justify-center
                            transition-all duration-300
                            ${index === currentStep 
                              ? 'bg-[#f15922] text-white' 
                              : index < currentStep
                                ? 'bg-[#f15922]/20 text-[#f15922]'
                                : 'bg-gray-200 text-gray-400'
                            }
                          `}
                        >
                          <Icon size={20} />
                        </div>
                        <div className="text-center mt-2">
                          <div className={`
                            text-xs font-medium
                            ${index === currentStep 
                              ? 'text-[#f15922]' 
                              : index < currentStep
                                ? 'text-gray-700'
                                : 'text-gray-400'
                            }
                          `}>
                            {step.title}
                          </div>
                          <div className="text-[10px] text-gray-500 hidden md:block">
                            {step.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step content */}
              <div className="mt-8">
                {renderWizardStep()}
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between mt-8 pt-4 border-t">
                <button
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className={`
                    px-4 py-2 rounded-lg flex items-center gap-2
                    ${currentStep === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <ArrowLeft size={18} />
                  Retour
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowHelp(!showHelp)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                  >
                    <HelpCircle size={20} />
                  </button>
                  {currentStep === wizardSteps.length - 1 ? (
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#f15922]/90 flex items-center gap-2"
                    >
                      <Save size={18} />
                      Enregistrer le modèle
                    </button>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#f15922]/90 flex items-center gap-2"
                    >
                      Suivant
                      <ArrowRight size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Help panel */}
              <AnimatePresence>
                {showHelp && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-6 right-6 w-80 bg-white rounded-lg shadow-xl border p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Aide</h4>
                      <button
                        onClick={() => setShowHelp(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p className="mb-2">
                        {wizardSteps[currentStep].description}
                      </p>
                      {currentStep === 0 && (
                        <ul className="space-y-1 list-disc pl-4">
                          <li>Le type détermine la structure et l'approche du rapport</li>
                          <li>Choisissez en fonction de votre objectif principal</li>
                          <li>Vous pouvez personnaliser chaque aspect ensuite</li>
                        </ul>
                      )}
                      {currentStep === 1 && (
                        <ul className="space-y-1 list-disc pl-4">
                          <li>Utilisez un nom clair et descriptif</li>
                          <li>La description aide les utilisateurs à choisir le bon modèle</li>
                          <li>Le dossier permet d'organiser vos modèles</li>
                        </ul>
                      )}
                      {currentStep === 2 && (
                        <ul className="space-y-1 list-disc pl-4">
                          <li>Une section par ligne</li>
                          <li>Ajoutez * pour les sections obligatoires</li>
                          <li>Organisez du général au spécifique</li>
                        </ul>
                      )}
                      {currentStep === 3 && (
                        <ul className="space-y-1 list-disc pl-4">
                          <li>Soyez précis dans vos instructions</li>
                          <li>Spécifiez le niveau de détail souhaité</li>
                          <li>Incluez des exemples si nécessaire</li>
                        </ul>
                      )}
                      {currentStep === 4 && (
                        <ul className="space-y-1 list-disc pl-4">
                          <li>Vérifiez tous les paramètres</li>
                          <li>Assurez-vous que la structure est complète</li>
                          <li>Confirmez que les instructions sont claires</li>
                        </ul>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex gap-6">
              {/* Arborescence des dossiers (25%) */}
              <div className="w-1/4">
                <div className="bg-white rounded-lg border p-4 h-[600px] overflow-y-auto">
                  {folders
                    .filter(f => !f.parent_id)
                    .map(folder => (
                      <FolderTreeItem
                        key={folder.id}
                        folder={folder}
                        level={0}
                        selectedFolder={selectedFolder}
                        templateCounts={templateCounts}
                        onSelect={setSelectedFolder}
                        onCreateFolder={handleCreateFolder}
                        onRenameFolder={handleRenameFolder}
                        onDeleteFolder={handleDeleteFolder}
                      />
                    ))}
                </div>
              </div>

              {/* Liste des modèles (75%) */}
              <div className="flex-1">
                <div className="bg-white rounded-lg border overflow-hidden">
                  <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          setCurrentTemplate({
                            name: '',
                            description: '',
                            icon: 'FileText',
                            type: 'summary',
                            prompt: '',
                            structure: '',
                            is_active: true,
                            folder_id: selectedFolder?.id || null
                          });
                          setIsEditing(true);
                          setCurrentStep(0);
                        }}
                        className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#f15922]/90 flex items-center gap-2"
                      >
                        <Plus size={18} />
                        Nouveau modèle
                      </button>
                      <div>
                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                        >
                          <option value="all">Tous les types</option>
                          <option value="summary">Résumé</option>
                          <option value="analysis">Analyse</option>
                          <option value="comparison">Comparaison</option>
                          <option value="extraction">Extraction</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {isLoading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f15922] mx-auto"></div>
                            <p className="mt-2">Chargement des modèles...</p>
                          </td>
                        </tr>
                      ) : templates.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                            Aucun modèle disponible
                          </td>
                        </tr>
                      ) : (
                        templates
                          .filter(template => 
                            (!selectedFolder || template.folder_id === selectedFolder.id) &&
                            (typeFilter === 'all' || template.type === typeFilter)
                          )
                          .map((template) => {
                            const IconComponent = getIconComponent(template.icon);
                            return (
                              <tr key={template.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="text-[#f15922]">
                                      <IconComponent size={18} />
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">{template.name}</div>
                                      <div className="text-sm text-gray-500">{template.description}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                    {template.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    template.is_active 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {template.is_active ? 'Actif' : 'Inactif'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <button
                                    onClick={() => {
                                      setCurrentTemplate(template);
                                      setIsEditing(true);
                                      setCurrentStep(0);
                                    }}
                                    className="text-blue-600 hover:text-blue-900 mr-3"
                                  >
                                    <Edit size={18} />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm('Êtes-vous sûr de vouloir supprimer ce modèle?')) {
                                        try {
                                          await deleteReportTemplate(template.id);
                                          await loadTemplates();
                                        } catch (error) {
                                          setError('Erreur lors de la suppression');
                                        }
                                      }
                                    }}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    <Trash size={18} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}