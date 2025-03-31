import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Download, Mail, Eye, Plus, Search, Filter, Calendar, Loader2, CheckCircle, AlertTriangle, FileSpreadsheet, BarChart, Trash2, Edit2, XCircle } from 'lucide-react';
import { useConversationStore } from '../lib/conversationStore';
import { generateReport } from '../lib/reportGenerator';
import { fetchReportTemplates, ReportTemplate } from '../lib/reportTemplateService';
import { EnhancedMarkdown } from './EnhancedMarkdown';

interface ReportManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Report {
  id: string;
  title: string;
  template: string;
  status: 'generating' | 'completed' | 'error';
  createdAt: Date;
  content?: string;
  error?: string;
  documents: Array<{
    name: string;
    type: string;
  }>;
}

export function ReportManager({ isOpen, onClose }: ReportManagerProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'generate'>('list');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'summary' | 'analysis' | 'comparison' | 'extraction'>('all');
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const { documents } = useConversationStore();

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      // Load reports from localStorage
      const savedReports = localStorage.getItem('reports');
      if (savedReports) {
        const parsedReports = JSON.parse(savedReports);
        // Filter out cancelled reports
        const validReports = parsedReports
          .filter((r: any) => !(r.status === 'error' && r.error === 'Génération annulée'))
          .map((r: any) => ({
            ...r,
            createdAt: new Date(r.createdAt)
          }));
        setReports(validReports);
      }
    }
  }, [isOpen]);

  // Save reports to localStorage when they change
  useEffect(() => {
    // Filter out cancelled reports before saving
    const validReports = reports.filter(r => !(r.status === 'error' && r.error === 'Génération annulée'));
    if (validReports.length > 0) {
      localStorage.setItem('reports', JSON.stringify(validReports));
    } else {
      localStorage.removeItem('reports');
    }
  }, [reports]);

  const loadTemplates = async () => {
    try {
      const templates = await fetchReportTemplates();
      setTemplates(templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setError('Erreur lors du chargement des modèles');
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedTemplate || isGenerating) return;
    
    setIsGenerating(true);
    setError(null);

    // Create new report object
    const newReport: Report = {
      id: crypto.randomUUID(),
      title: `${selectedTemplate.name} - ${new Date().toLocaleDateString()}`,
      template: selectedTemplate.name,
      status: 'generating',
      createdAt: new Date(),
      documents: documents.map(d => ({
        name: d.documents.name,
        type: d.documents.type
      }))
    };
    
    try {
      setReports(prev => [newReport, ...prev]);
      setActiveTab('list'); // Switch to list view to show progress
      
      const content = await generateReport(documents, selectedTemplate);
      
      setReports(prev => 
        prev.map(r => 
          r.id === newReport.id 
            ? { ...r, status: 'completed', content } 
            : r
        )
      );
    } catch (error) {
      console.error('Error generating report:', error);
      
      setReports(prev => 
        prev.map(r => 
          r.id === newReport.id 
            ? { ...r, status: 'error', error: error instanceof Error ? error.message : 'Error generating report' } 
            : r
        )
      );
      setError(error instanceof Error ? error.message : 'Erreur lors de la génération du rapport');
    } finally {
      setIsGenerating(false);
      setSelectedTemplate(null);
    }
  };

  const handleDownload = (report: Report) => {
    if (!report.content) return;
    
    const blob = new Blob([report.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.title}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDelete = (reportId: string) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
  };

  const handleSendEmail = (report: Report) => {
    // Implement email sending functionality
    alert('Fonctionnalité d\'envoi par email en développement');
  };

  const handleStartEditing = (report: Report) => {
    setEditingReportId(report.id);
    setEditingTitle(report.title);
  };

  const handleSaveEdit = () => {
    if (!editingReportId || !editingTitle.trim()) return;
    
    setReports(prev => 
      prev.map(r => 
        r.id === editingReportId 
          ? { ...r, title: editingTitle.trim() } 
          : r
      )
    );
    
    setEditingReportId(null);
    setEditingTitle('');
  };

  const filteredReports = reports.filter(report => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!report.title.toLowerCase().includes(query) && 
          !report.template.toLowerCase().includes(query)) {
        return false;
      }
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const reportDate = new Date(report.createdAt);
      
      switch (dateFilter) {
        case 'today':
          if (reportDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'week':
          const weekAgo = new Date(now.setDate(now.getDate() - 7));
          if (reportDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
          if (reportDate < monthAgo) return false;
          break;
      }
    }

    return true;
  });

  // Count generating reports
  const generatingReports = reports.filter(r => r.status === 'generating').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-[90vw] h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={24} />
            Gestionnaire de Rapports
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('list')}
              className={`header-neumorphic-button px-4 py-2 rounded-lg flex items-center gap-2 text-white ${
                activeTab === 'list' ? 'bg-white/20' : ''
              }`}
            >
              <FileSpreadsheet size={18} />
              <span>Mes rapports</span>
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              className={`header-neumorphic-button px-4 py-2 rounded-lg flex items-center gap-2 text-white ${
                activeTab === 'generate' ? 'bg-white/20' : ''
              }`}
            >
              <BarChart size={18} />
              <span>Générer</span>
            </button>
            <button
              onClick={onClose}
              className="header-neumorphic-button w-8 h-8 rounded-full flex items-center justify-center text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'list' ? (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="h-full flex flex-col"
              >
                <div className="p-4 border-b bg-gray-50">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rechercher
                      </label>
                      <div className="relative">
                        <Search 
                          size={18} 
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                        />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Rechercher un rapport..."
                          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type
                      </label>
                      <div className="relative">
                        <Filter 
                          size={18} 
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                        />
                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                          className="w-full pl-10 pr-4 py-2 border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                        >
                          <option value="all">Tous les types</option>
                          <option value="summary">Résumé</option>
                          <option value="analysis">Analyse</option>
                          <option value="comparison">Comparaison</option>
                          <option value="extraction">Extraction</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Période
                      </label>
                      <div className="relative">
                        <Calendar 
                          size={18} 
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                        />
                        <select
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
                          className="w-full pl-10 pr-4 py-2 border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[#f15922] focus:border-transparent"
                        >
                          <option value="all">Toutes les dates</option>
                          <option value="today">Aujourd'hui</option>
                          <option value="week">Cette semaine</option>
                          <option value="month">Ce mois</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredReports.map((report) => (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="report-item bg-white rounded-lg border shadow-sm overflow-hidden"
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="text-[#f15922] flex-shrink-0">
                              <FileText size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                              {editingReportId === report.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onBlur={handleSaveEdit}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit();
                                      if (e.key === 'Escape') {
                                        setEditingReportId(null);
                                        setEditingTitle('');
                                      }
                                    }}
                                    className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-[#f15922]"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleSaveEdit}
                                    className="p-1 text-green-500 hover:bg-green-50 rounded"
                                  >
                                    <CheckCircle size={16} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-gray-900 truncate flex-1">
                                    {report.title}
                                  </h4>
                                  <button
                                    onClick={() => handleStartEditing(report)}
                                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                </div>
                              )}
                              <p className="text-sm text-gray-500 truncate mt-1">
                                {report.template}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`
                                  inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                  ${report.status === 'completed' 
                                    ? 'bg-green-50 text-green-700' 
                                    : report.status === 'generating'
                                    ? 'bg-orange-50 text-orange-700'
                                    : 'bg-red-50 text-red-700'
                                  }
                                `}>
                                  {report.status === 'completed' && <CheckCircle size={14} className="mr-1" />}
                                  {report.status === 'generating' && <Loader2 size={14} className="mr-1 animate-spin" />}
                                  {report.status === 'error' && <AlertTriangle size={14} className="mr-1" />}
                                  {report.status === 'completed' 
                                    ? 'Complété' 
                                    : report.status === 'error'
                                    ? 'Erreur'
                                    : 'En cours'
                                  }
                                </span>
                                <span className="text-xs text-gray-500">
                                  {report.createdAt.toLocaleString()}
                                </span>
                              </div>
                              {report.documents && report.documents.length > 0 && (
                                <div className="mt-3 space-y-1">
                                  <p className="text-xs font-medium text-gray-500">Documents utilisés :</p>
                                  <div className="space-y-1">
                                    {report.documents.map((doc, index) => (
                                      <div key={index} className="text-xs text-gray-600 flex items-center gap-1">
                                        <FileText size={12} className="flex-shrink-0" />
                                        <span className="truncate">{doc.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          {report.status === 'completed' && (
                            <div className="actions flex items-center justify-end gap-2 mt-4">
                              <button
                                onClick={() => handleDownload(report)}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Télécharger"
                              >
                                <Download size={18} />
                              </button>
                              <button
                                onClick={() => handleSendEmail(report)}
                                className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Envoyer par email"
                              >
                                <Mail size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  setPreviewContent(report.content || null);
                                  setIsPreviewOpen(true);
                                }}
                                className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                                title="Aperçu"
                              >
                                <Eye size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(report.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                          {report.status === 'error' && (
                            <div className="mt-4 p-2 bg-red-50 text-red-700 text-sm rounded-lg">
                              {report.error}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="generate"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col"
              >
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900">
                    Générer un nouveau rapport
                  </h3>
                  <p className="text-sm text-gray-600">
                    Sélectionnez un modèle pour générer un rapport à partir des {documents.length} document(s) actifs
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className={`template-card p-4 rounded-lg border-2 cursor-pointer ${
                          selectedTemplate?.id === template.id ? 'selected' : ''
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="icon p-2 rounded-lg">
                            <FileText size={24} />
                          </div>
                          <h4 className="text-lg font-medium">{template.name}</h4>
                        </div>
                        <p className="text-gray-600 mb-3">
                          {template.description}
                        </p>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">
                            Structure du rapport :
                          </h5>
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                            {typeof template.structure === 'string' 
                              ? template.structure 
                              : template.structure?.sections
                                  ?.map(s => `${s.title}${s.required ? '*' : ''}`)
                                  .join('\n')}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-t bg-gray-50">
                  <button
                    onClick={handleGenerateReport}
                    disabled={!selectedTemplate || isGenerating}
                    className={`
                      w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2
                      ${!selectedTemplate || isGenerating
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-[#f15922] text-white hover:bg-[#f15922]/90'
                      }
                    `}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        <span>Génération en cours...</span>
                      </>
                    ) : (
                      <>
                        <FileText size={20} />
                        <span>Générer le rapport</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Preview Modal */}
        {isPreviewOpen && previewContent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="preview-modal w-[90vw] h-[85vh] flex flex-col">
              <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Eye size={24} />
                  Aperçu du Rapport
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPreviewOpen(false)}
                    className="header-neumorphic-button w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="preview-modal-content flex-1 bg-gray-100 p-8 overflow-y-auto">
                <div className="preview-document bg-white rounded-lg shadow-lg max-w-4xl mx-auto p-12">
                  <EnhancedMarkdown content={previewContent} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="absolute bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle size={20} />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-700 hover:text-red-900"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Generation Status Indicator */}
        <AnimatePresence>
          {!isPreviewOpen && generatingReports > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 flex items-center gap-3"
            >
              <Loader2 className="animate-spin text-[#f15922]" size={20} />
              <span className="text-gray-700">
                {generatingReports === 1 
                  ? 'Génération du rapport en cours...'
                  : `${generatingReports} rapports en cours de génération...`
                }
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}