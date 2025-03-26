import React, { useState, useEffect } from 'react';
import { FileText, Download, Mail, Eye, X, Loader2, Database } from 'lucide-react';
import { useConversationStore } from '../lib/conversationStore';
import { useDocumentStore } from '../lib/documentStore';
import { generateReport } from '../lib/reportGenerator';
import { fetchReportTemplates, ReportTemplate } from '../lib/reportTemplateService';
import { ReportPreviewModal } from './ReportPreviewModal';
import { DocumentImportModal } from './DocumentImportModal';
import * as icons from 'lucide-react';

function getIconComponent(iconName: string) {
  return (icons as any)[iconName] || icons.FileText;
}

export function ReportGeneratorWidget() {
  const { documents } = useConversationStore();
  const { setModalOpen: setDocumentModalOpen } = useDocumentStore();
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportBlob, setReportBlob] = useState<Blob | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  useEffect(() => {
    async function loadTemplates() {
      if (!isOpen) return;
      
      setIsLoading(true);
      try {
        const templates = await fetchReportTemplates();
        setTemplates(templates);
      } catch (error) {
        console.error('Failed to load report templates:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadTemplates();
  }, [isOpen]);
  
  if (documents.length === 0) return null;

  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    try {
      const blob = await generateReport(documents, selectedTemplate);
      setReportBlob(blob);
      
      const reader = new FileReader();
      reader.onload = () => {
        setReportContent(reader.result as string);
        setShowSuccessMessage(true);
      };
      reader.readAsText(blob);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!reportBlob || !selectedTemplate) return;
    
    const url = URL.createObjectURL(reportBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${selectedTemplate.name}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendEmail = () => {
    alert('Fonctionnalité d\'envoi par email en développement');
  };

  const handleImport = () => {
    if (!reportBlob || !selectedTemplate) return;
    
    // Create a File object from the Blob
    const file = new File([reportBlob], `rapport-${selectedTemplate.name}-${new Date().toISOString().split('T')[0]}.html`, {
      type: 'text/html'
    });

    // Store the file in localStorage for the import modal
    localStorage.setItem('pendingReportImport', JSON.stringify({
      name: file.name,
      type: file.type,
      size: file.size,
      content: reportContent
    }));

    // Open the document import modal
    setDocumentModalOpen(true);
  };

  const handleOpenPreview = () => {
    setIsPreviewOpen(true);
    setShowSuccessMessage(false);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-24 right-8 z-10">
        {/* Widget button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
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

        {/* Widget content */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 w-96 bg-white rounded-lg shadow-xl overflow-hidden transition-all">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">Générer un Rapport</h3>
              <p className="text-sm text-gray-600">
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
                  <button
                    onClick={handleOpenPreview}
                    className="chat-neumorphic-button px-4 py-2 rounded-lg flex items-center gap-2 text-[#f15922]"
                  >
                    <Eye size={18} />
                    <span>Voir le rapport</span>
                  </button>
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
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        content={reportContent || ''}
        onDownload={handleDownload}
        onSendEmail={handleSendEmail}
        onImport={handleImport}
      />
    </>
  );
}