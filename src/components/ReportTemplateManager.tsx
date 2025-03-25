import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash, Save, X, FileText, AlertTriangle, Layers } from 'lucide-react';
import { fetchReportTemplates, createReportTemplate, updateReportTemplate, deleteReportTemplate, ReportTemplate } from '../lib/reportTemplateService';
import { fetchReportTypes, createReportType, updateReportType, deleteReportType, reorderReportTypes, ReportType } from '../lib/reportTypeService';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { TypeManager } from './TypeManager';
import { TypeModal } from './TypeModal';
import * as icons from 'lucide-react';

const iconOptions = [
  'FileText', 'FileChart', 'FileSpreadsheet', 'FileSearch', 
  'FileCode', 'FileDigit', 'PieChart', 'BarChart', 'LineChart', 
  'ScatterChart', 'AreaChart', 'BookOpen', 'Book', 'ClipboardList'
];

const typeOptions = [
  { value: 'summary', label: 'Résumé' },
  { value: 'analysis', label: 'Analyse' },
  { value: 'comparison', label: 'Comparaison' },
  { value: 'extraction', label: 'Extraction' }
] as const;

function getIconComponent(iconName: string) {
  return (icons as any)[iconName] || icons.FileText;
}

interface ReportTemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'templates' | 'types';

export function ReportTemplateManager({ isOpen, onClose }: ReportTemplateManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('templates');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [types, setTypes] = useState<ReportType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTemplate, setCurrentTemplate] = useState<Partial<ReportTemplate> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeModal, setTypeModal] = useState<{
    isOpen: boolean;
    type?: ReportType;
  }>({
    isOpen: false
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    template: ReportTemplate | null;
    isDeleting: boolean;
  }>({
    isOpen: false,
    template: null,
    isDeleting: false
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [templatesData, typesData] = await Promise.all([
        fetchReportTemplates(),
        fetchReportTypes()
      ]);
      setTemplates(templatesData);
      setTypes(typesData);
    } catch (error) {
      setError('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  }

  const handleAddNew = () => {
    setCurrentTemplate({
      name: '',
      description: '',
      icon: 'FileText',
      type: 'summary',
      prompt: '',
      is_active: true,
      structure: {
        sections: [
          { title: 'Introduction', required: true },
          { title: 'Contenu', required: true },
          { title: 'Conclusion', required: true }
        ]
      }
    });
    setIsEditing(true);
  };

  const handleEdit = (template: ReportTemplate) => {
    setCurrentTemplate({ ...template });
    setIsEditing(true);
  };

  const handleDelete = async (template: ReportTemplate) => {
    setDeleteConfirmation({
      isOpen: true,
      template,
      isDeleting: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.template) return;
    
    try {
      setDeleteConfirmation(prev => ({ ...prev, isDeleting: true }));
      await deleteReportTemplate(deleteConfirmation.template.id);
      setTemplates(prev => prev.filter(t => t.id !== deleteConfirmation.template!.id));
      setDeleteConfirmation({ isOpen: false, template: null, isDeleting: false });
    } catch (error) {
      console.error('Failed to delete template:', error);
      setError('Erreur lors de la suppression du modèle');
      setDeleteConfirmation(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const handleSave = async () => {
    if (!currentTemplate?.name || !currentTemplate.prompt) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    try {
      if ('id' in currentTemplate && currentTemplate.id) {
        const updatedTemplate = await updateReportTemplate(currentTemplate.id, currentTemplate);
        setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
      } else {
        const newTemplate = await createReportTemplate(currentTemplate as Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>);
        setTemplates(prev => [...prev, newTemplate]);
      }
      
      setIsEditing(false);
      setCurrentTemplate(null);
    } catch (error) {
      setError('Erreur lors de l\'enregistrement');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setCurrentTemplate(null);
    setError(null);
  };

  // Type management handlers
  const handleAddType = () => {
    setTypeModal({ isOpen: true });
  };

  const handleEditType = (type: ReportType) => {
    setTypeModal({ isOpen: true, type });
  };

  const handleDeleteType = async (type: ReportType) => {
    try {
      await deleteReportType(type.id);
      setTypes(prev => prev.filter(t => t.id !== type.id));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erreur lors de la suppression du type');
    }
  };

  const handleTypeSubmit = async (typeData: Omit<ReportType, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (typeModal.type) {
        const updatedType = await updateReportType(typeModal.type.id, typeData);
        setTypes(prev => prev.map(t => t.id === updatedType.id ? updatedType : t));
      } else {
        const newType = await createReportType(typeData);
        setTypes(prev => [...prev, newType]);
      }
      setTypeModal({ isOpen: false });
    } catch (error) {
      throw error;
    }
  };

  const handleReorderTypes = async (reorderedTypes: ReportType[]) => {
    try {
      setTypes(reorderedTypes);
      await reorderReportTypes(reorderedTypes);
    } catch (error) {
      setError('Erreur lors de la réorganisation des types');
      // Revert to previous order
      loadData();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col">
          <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FileText size={24} />
              Gestionnaire de Modèles de Rapports
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="border-b border-gray-200">
            <div className="px-6 flex space-x-4">
              <button
                className={`py-4 px-4 inline-flex items-center gap-2 border-b-2 font-medium text-sm ${
                  activeTab === 'templates'
                    ? 'border-[#f15922] text-[#f15922]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('templates')}
              >
                <FileText size={20} />
                Modèles
              </button>
              <button
                className={`py-4 px-4 inline-flex items-center gap-2 border-b-2 font-medium text-sm ${
                  activeTab === 'types'
                    ? 'border-[#f15922] text-[#f15922]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('types')}
              >
                <Layers size={20} />
                Types
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
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

            {activeTab === 'templates' ? (
              isEditing ? (
                <div className="bg-white rounded-lg">
                  <h3 className="text-lg font-medium mb-4">
                    {currentTemplate?.id ? 'Modifier le Modèle' : 'Nouveau Modèle'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nom*
                        </label>
                        <input
                          type="text"
                          value={currentTemplate?.name || ''}
                          onChange={e => setCurrentTemplate({...currentTemplate!, name: e.target.value})}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                          placeholder="Nom du modèle"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={currentTemplate?.description || ''}
                          onChange={e => setCurrentTemplate({...currentTemplate!, description: e.target.value})}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                          placeholder="Description du modèle"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Icône
                        </label>
                        <select
                          value={currentTemplate?.icon || 'FileText'}
                          onChange={e => setCurrentTemplate({...currentTemplate!, icon: e.target.value})}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                        >
                          {iconOptions.map(icon => (
                            <option key={icon} value={icon}>{icon}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Type
                        </label>
                        <select
                          value={currentTemplate?.type || 'summary'}
                          onChange={e => setCurrentTemplate({...currentTemplate!, type: e.target.value as ReportTemplate['type']})}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                        >
                          {typeOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prompt IA*
                      </label>
                      <textarea
                        value={currentTemplate?.prompt || ''}
                        onChange={e => setCurrentTemplate({...currentTemplate!, prompt: e.target.value})}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] h-[200px] resize-none"
                        placeholder="Instructions détaillées pour l'IA"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Décrivez en détail comment l'IA doit générer le rapport.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Structure (JSON)
                      </label>
                      <textarea
                        value={currentTemplate?.structure ? JSON.stringify(currentTemplate.structure, null, 2) : ''}
                        onChange={e => {
                          try {
                            const struct = e.target.value ? JSON.parse(e.target.value) : null;
                            setCurrentTemplate({...currentTemplate!, structure: struct});
                            setError(null);
                          } catch (err) {
                            setError('Format JSON invalide');
                          }
                        }}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#f15922] h-[100px] resize-none font-mono text-sm"
                        placeholder="{ 'sections': [{'title': 'Introduction', 'required': true}] }"
                      />
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={currentTemplate?.is_active ?? true}
                        onChange={e => setCurrentTemplate({...currentTemplate!, is_active: e.target.checked})}
                        className="h-4 w-4 text-[#f15922] focus:ring-[#f15922] rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        Modèle actif
                      </label>
                    </div>
                  </div>
                </div>
              ) : isLoading ? (
                <div className="text-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#f15922] mx-auto"></div>
                  <p className="mt-3 text-gray-600">Chargement des modèles...</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg overflow-hidden">
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={handleAddNew}
                      className="flex items-center gap-2 px-3 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#f15922]/90 transition-colors"
                    >
                      <Plus size={18} />
                      <span>Nouveau Modèle</span>
                    </button>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {templates.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                            Aucun modèle disponible
                          </td>
                        </tr>
                      ) : (
                        templates.map((template) => {
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
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleEdit(template)}
                                    className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Modifier"
                                  >
                                    <Edit size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(template)}
                                    className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Supprimer définitivement"
                                  >
                                    <Trash size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <TypeManager
                types={types}
                onAdd={handleAddType}
                onEdit={handleEditType}
                onDelete={handleDeleteType}
                onReorder={handleReorderTypes}
              />
            )}
          </div>

          {isEditing && (
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[#f15922] text-white rounded-md hover:bg-[#f15922]/90 flex items-center gap-2"
              >
                <Save size={18} />
                Enregistrer
              </button>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Supprimer le modèle de rapport"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le modèle "${deleteConfirmation.template?.name}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation({ isOpen: false, template: null, isDeleting: false })}
        isDeleting={deleteConfirmation.isDeleting}
      />

      <TypeModal
        isOpen={typeModal.isOpen}
        onClose={() => setTypeModal({ isOpen: false })}
        onSubmit={handleTypeSubmit}
        title={typeModal.type ? 'Modifier le Type' : 'Nouveau Type'}
        type={typeModal.type}
      />
    </>
  );
}