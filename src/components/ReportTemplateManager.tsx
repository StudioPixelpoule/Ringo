import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash, Save, X, FileText, AlertTriangle } from 'lucide-react';
import { fetchReportTemplates, createReportTemplate, updateReportTemplate, deleteReportTemplate, ReportTemplate } from '../lib/reportTemplateService';
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

export function ReportTemplateManager({ isOpen, onClose }: ReportTemplateManagerProps) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTemplate, setCurrentTemplate] = useState<Partial<ReportTemplate> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
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

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce modèle?')) return;
    
    try {
      await deleteReportTemplate(id);
      await loadTemplates();
    } catch (error) {
      setError('Erreur lors de la suppression');
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
      await loadTemplates();
    } catch (error) {
      setError('Erreur lors de l\'enregistrement');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setCurrentTemplate(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[90vw] max-w-4xl mx-4 max-h-[85vh] flex flex-col">
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={24} />
            Gestionnaire de Modèles de Rapports
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNew}
              disabled={isEditing}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
              title="Nouveau modèle"
            >
              <Plus size={20} />
            </button>
            <button
              onClick={onClose}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 flex items-center gap-2">
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => handleEdit(template)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(template.id)}
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
  );
}