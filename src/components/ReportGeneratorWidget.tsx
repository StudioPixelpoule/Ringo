import React, { useState, useEffect } from 'react';
import { FileText, Download, Mail, Eye, X, Loader2, Database, Trash2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConversationStore } from '../lib/conversationStore';
import { useDocumentStore } from '../lib/documentStore';
import { generateReport } from '../lib/reportGenerator';
import { fetchReportTemplates, ReportTemplate } from '../lib/reportTemplateService';
import { ReportPreviewModal } from './ReportPreviewModal';
import { DocumentImportModal } from './DocumentImportModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import * as icons from 'lucide-react';

function getIconComponent(iconName: string) {
  return (icons as any)[iconName] || icons.FileText;
}

interface SavedReport {
  id: string;
  title: string;
  date: string;
  template: string;
  content: string;
}

export function ReportGeneratorWidget() {
  const { documents } = useConversationStore();
  const { setModalOpen: setDocumentModalOpen } = useDocumentStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'saved'>('generate');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportBlob, setReportBlob] = useState<Blob | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [hasNewReport, setHasNewReport] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    report: SavedReport | null;
    isDeleting: boolean;
  }>({
    isOpen: false,
    report: null,
    isDeleting: false
  });
  
  useEffect(() => {
    async function loadTemplates() {
      if (!isOpen) return;
      
      setIsLoading(true);
      try {
        const templates = await fetchReportTemplates();
        setTemplates(templates);
        
        // Load saved reports from localStorage
        const saved = localStorage.getItem('savedReports');
        if (saved) {
          setSavedReports(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load report templates:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadTemplates();
  }, [isOpen]);

  // Reset states when closing preview
  useEffect(() => {
    if (!isPreviewOpen) {
      setShowSuccessMessage(false);
      setSelectedTemplate(null);
      setReportContent(null);
      setReportBlob(null);
    }
  }, [isPreviewOpen]);
  
  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    try {
      const blob = await generateReport(documents, selectedTemplate);
      setReportBlob(blob);
      
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        setReportContent(content);
        setShowSuccessMessage(true);
        
        // Save report
        const newReport: SavedReport = {
          id: Date.now().toString(),
          title: `${selectedTemplate.name} - ${new Date().toLocaleDateString('fr-FR')}`,
          date: new Date().toISOString(),
          template: selectedTemplate.name,
          content
        };
        
        const updatedReports = [newReport, ...savedReports];
        setSavedReports(updatedReports);
        localStorage.setItem('savedReports', JSON.stringify(updatedReports));

        // Show notification if widget is closed
        if (!isOpen) {
          setHasNewReport(true);
        }
      };
      reader.readAsText(blob);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (report: SavedReport) => {
    const blob = new Blob([report.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendEmail = (report: SavedReport) => {
    alert('Fonctionnalité d\'envoi par email en développement');
  };

  const handleImport = (report: SavedReport) => {
    // Create a File object from the content
    const file = new File([report.content], `${report.title}.html`, {
      type: 'text/html'
    });

    // Store the file in localStorage for the import modal
    localStorage.setItem('pendingReportImport', JSON.stringify({
      name: file.name,
      type: file.type,
      content: report.content
    }));

    // Open the document import modal
    setDocumentModalOpen(true);
  };

  const handleDeleteClick = (report: SavedReport) => {
    setDeleteConfirmation({
      isOpen: true,
      report,
      isDeleting: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.report) return;
    
    try {
      setDeleteConfirmation(prev => ({ ...prev, isDeleting: true }));
      
      const updatedReports = savedReports.filter(r => r.id !== deleteConfirmation.report!.id);
      setSavedReports(updatedReports);
      localStorage.setItem('savedReports', JSON.stringify(updatedReports));
      
      if (selectedReport?.id === deleteConfirmation.report.id) {
        setSelectedReport(null);
      }
      
      setDeleteConfirmation({ isOpen: false, report: null, isDeleting: false });
    } catch (error) {
      console.error('Error deleting report:', error);
      setDeleteConfirmation(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const handleOpenPreview = (report: SavedReport) => {
    setReportContent(report.content);
    setSelectedReport(report);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setSelectedReport(null);
  };

  const handleToggleWidget = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewReport(false);
    }
  };

  if (documents.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-24 right-8 z-10">
        {/* Widget button with notification */}
        <div className="relative">
          <button
            onClick={handleToggleWidget}
            className="flex items-center gap-2 bg-white p-3 rounded-full shadow-md hover:shadow-lg transition-all"
            style={{ backgroundColor: isOpen ? '#f15922' : 'white' }}
          >
            <FileText size={20} color={isOpen ? 'white' : '#f15922'} />
            {isOpen ? (
              <X size={20} color="white" />
            ) : (
              <span className="text-[#f15922] font-medium">Rapports</span>
            )}
          </button>
          
          {/* Notification dot */}
          <AnimatePresence>
            {!isOpen && hasNewReport && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
              >
                <Check size={12} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generation indicator */}
          <AnimatePresence>
            {!isOpen && isGenerating && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-[#f15922] rounded-full flex items-center justify-center"
              >
                <Loader2 size={12} className="text-white animate-spin" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Widget content */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 w-96 bg-white rounded-lg shadow-xl overflow-hidden transition-all">
            {/* Tabs */}
            <div className="flex border-b">
              <button
                className={`flex-1 py-3 px-4 text-sm font-medium ${
                  activeTab === 'generate'
                    ? 'text-[#f15922] border-b-2 border-[#f15922]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('generate')}
              >
                Générer un rapport
              </button>
              <button
                className={`flex-1 py-3 px-4 text-sm font-medium ${
                  activeTab === 'saved'
                    ? 'text-[#f15922] border-b-2 border-[#f15922]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('saved')}
              >
                Mes rapports
              </button>
            </div>
            
            {activeTab === 'generate' ? (
              <>
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Créez un rapport à partir des {documents.length} document(s) actifs
                  </p>
                </div>
                
                {/* Template list */}
                <div className="max-h-60 overflow-y-auto">
                  {isLoading ? (
                    <div className="p-4 text-center text-gray-500">
                      <Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" />
                      Chargement des modèles...
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Aucun modèle disponible
                    </div>
                  ) : (
                    templates.map((template) => {
                      const IconComponent = getIconComponent(template.icon);
                      return (
                        <div
                          key={template.id}
                          className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                            selectedTemplate?.id === template.id ? 'bg-[#f15922]/10' : ''
                          }`}
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <div className="bg-[#f15922]/10 p-2 rounded-md text-[#f15922]">
                            <IconComponent size={18} />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800">{template.name}</h4>
                            <p className="text-sm text-gray-600">{template.description}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Success message */}
                {showSuccessMessage && (
                  <div className="p-4 border-t bg-green-50">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-green-700 font-medium">Votre rapport est disponible !</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsPreviewOpen(true)}
                          className="chat-neumorphic-button px-4 py-2 rounded-lg flex items-center gap-2 text-[#f15922]"
                        >
                          <Eye size={18} />
                          <span>Voir le rapport</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowSuccessMessage(false);
                            setSelectedTemplate(null);
                          }}
                          className="chat-neumorphic-button px-4 py-2 rounded-lg flex items-center gap-2 text-gray-600"
                        >
                          <FileText size={18} />
                          <span>Nouveau rapport</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generate button */}
                {!showSuccessMessage && (
                  <div className="p-4 border-t">
                    <button
                      onClick={handleGenerateReport}
                      disabled={!selectedTemplate || isGenerating}
                      className={`w-full py-2 px-4 rounded-md flex items-center justify-center gap-2 ${
                        !selectedTemplate || isGenerating
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#f15922] text-white hover:bg-[#f15922]/90'
                      }`}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="animate-spin h-5 w-5" />
                          Génération en cours...
                        </>
                      ) : (
                        <>
                          <FileText size={18} />
                          Générer le Rapport
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {savedReports.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                    <p>Aucun rapport sauvegardé</p>
                  </div>
                ) : (
                  savedReports.map((report) => (
                    <div key={report.id} className="p-4 border-b hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{report.title}</h4>
                          <p className="text-sm text-gray-500">
                            {new Date(report.date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <p className="text-sm text-gray-500">{report.template}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleOpenPreview(report)}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            title="Aperçu"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleDownload(report)}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            title="Télécharger"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            onClick={() => handleSendEmail(report)}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            title="Envoyer par email"
                          >
                            <Mail size={18} />
                          </button>
                          <button
                            onClick={() => handleImport(report)}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            title="Importer dans la base"
                          >
                            <Database size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(report)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          handleClosePreview();
          // Reset success message to allow generating new report
          setShowSuccessMessage(false);
          setSelectedTemplate(null);
        }}
        content={reportContent || ''}
        onDownload={() => selectedReport ? handleDownload(selectedReport) : null}
        onSendEmail={() => selectedReport ? handleSendEmail(selectedReport) : null}
        onImport={() => selectedReport ? handleImport(selectedReport) : null}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Supprimer le rapport"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le rapport "${deleteConfirmation.report?.title}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation({ isOpen: false, report: null, isDeleting: false })}
        isDeleting={deleteConfirmation.isDeleting}
      />
    </>
  );
}