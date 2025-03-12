import React, { useState, useEffect } from 'react';
import { FileText, Download, Mail, Eye, X, Loader2 } from 'lucide-react';
import { useConversationStore } from '../lib/conversationStore';
import { generateReport } from '../lib/reportGenerator';
import { fetchReportTemplates, ReportTemplate } from '../lib/reportTemplateService';
import * as icons from 'lucide-react';

function getIconComponent(iconName: string) {
  return (icons as any)[iconName] || icons.FileText;
}

export function ReportGeneratorWidget() {
  const { documents } = useConversationStore();
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load templates when widget opens
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
  
  // Don't show if no documents in conversation
  if (documents.length === 0) return null;

  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    try {
      const reportBlob = await generateReport(documents, selectedTemplate);
      const url = URL.createObjectURL(reportBlob);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!previewUrl || !selectedTemplate) return;
    
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `rapport-${selectedTemplate.name}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSendEmail = () => {
    alert('Fonctionnalité d\'envoi par email en développement');
  };

  return (
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

          {/* Preview */}
          {previewUrl && (
            <div className="p-4 border-t border-b">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Prévisualisation</h4>
                <button 
                  className="text-blue-600 text-sm hover:text-blue-700" 
                  onClick={() => window.open(previewUrl, '_blank')}
                >
                  <Eye size={16} className="inline mr-1" /> Ouvrir
                </button>
              </div>
              <div className="h-32 border rounded bg-gray-50 overflow-hidden">
                <iframe
                  src={previewUrl}
                  className="w-full h-full"
                  title="Prévisualisation du rapport"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 flex flex-col gap-2">
            <button
              className={`w-full py-2 px-4 rounded-md flex items-center justify-center gap-2 ${
                selectedTemplate && !isLoading
                  ? 'bg-[#f15922] text-white hover:bg-[#f15922]/90'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              onClick={handleGenerateReport}
              disabled={!selectedTemplate || isGenerating || isLoading}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <FileText size={18} />
                  {previewUrl ? 'Régénérer le Rapport' : 'Générer le Rapport'}
                </>
              )}
            </button>
            
            {previewUrl && (
              <div className="flex gap-2 mt-2">
                <button
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md flex items-center justify-center gap-2 hover:bg-blue-700"
                  onClick={handleDownload}
                >
                  <Download size={18} />
                  Télécharger
                </button>
                <button
                  className="flex-1 py-2 px-4 bg-green-600 text-white rounded-md flex items-center justify-center gap-2 hover:bg-green-700"
                  onClick={handleSendEmail}
                >
                  <Mail size={18} />
                  Envoyer par Email
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}