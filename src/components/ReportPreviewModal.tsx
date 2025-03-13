import React from 'react';
import { X, Download, Mail, Database, Eye } from 'lucide-react';

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onDownload: () => void;
  onSendEmail: () => void;
  onImport: () => void;
}

export function ReportPreviewModal({
  isOpen,
  onClose,
  content,
  onDownload,
  onSendEmail,
  onImport
}: ReportPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[90vw] h-[85vh] flex flex-col overflow-hidden">
        <div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Eye size={24} />
            Aperçu du Rapport
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onDownload}
              className="header-neumorphic-button w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform"
              title="Télécharger en PDF"
            >
              <Download size={20} />
            </button>
            <button
              onClick={onSendEmail}
              className="header-neumorphic-button w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform"
              title="Envoyer par email"
            >
              <Mail size={20} />
            </button>
            <button
              onClick={onImport}
              className="header-neumorphic-button w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform"
              title="Importer dans la base"
            >
              <Database size={20} />
            </button>
            <button
              onClick={onClose}
              className="header-neumorphic-button w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto bg-gray-100">
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl mx-auto p-12"
            style={{
              minHeight: 'calc(100% - 2rem)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
          >
            <style>
              {`
                .preview-content {
                  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                }

                .preview-content h1 {
                  color: #f15922;
                  font-size: 28px;
                  font-weight: 700;
                  margin: 2em 0 1em;
                  padding-bottom: 0.5em;
                  border-bottom: 2px solid #f15922;
                }

                .preview-content h2 {
                  color: #dba747;
                  font-size: 24px;
                  font-weight: 700;
                  margin: 1.5em 0 1em;
                  padding-bottom: 0.3em;
                  border-bottom: 1px solid #dba747;
                }

                .preview-content h3 {
                  color: #444;
                  font-size: 20px;
                  font-weight: 600;
                  margin: 1.2em 0 0.8em;
                }

                .preview-content p {
                  margin: 0 0 1em;
                  line-height: 1.8;
                  font-weight: normal;
                }

                .preview-content ul,
                .preview-content ol {
                  margin: 1em 0;
                  padding-left: 2em;
                }

                .preview-content li {
                  margin: 0.5em 0;
                  line-height: 1.6;
                  font-weight: normal;
                }

                .preview-content ul li {
                  list-style-type: none;
                  position: relative;
                }

                .preview-content ul li::before {
                  content: "•";
                  color: #f15922;
                  font-weight: bold;
                  position: absolute;
                  left: -1.2em;
                }

                .preview-content strong {
                  color: inherit;
                  font-weight: 600;
                }

                .preview-content em {
                  font-style: italic;
                  color: #666;
                }

                .preview-content blockquote {
                  margin: 1.5em 0;
                  padding: 1em 1.5em;
                  border-left: 4px solid #dba747;
                  background-color: #f8f9fa;
                  color: #555;
                  font-style: italic;
                }

                .preview-content table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 1.5em 0;
                  background: #fff;
                  border: 1px solid #e0e0e0;
                }

                .preview-content th,
                .preview-content td {
                  padding: 12px 15px;
                  text-align: left;
                  border: 1px solid #e0e0e0;
                }

                .preview-content th {
                  background-color: #f5f5f5;
                  font-weight: 600;
                  color: #333;
                }

                .preview-content tr:nth-child(even) {
                  background-color: #f9f9f9;
                }

                .preview-content pre {
                  background-color: #f6f8fa;
                  border: 1px solid #e1e4e8;
                  border-radius: 6px;
                  padding: 16px;
                  overflow: auto;
                  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                  font-size: 85%;
                  line-height: 1.45;
                  margin: 1.5em 0;
                }

                .preview-content code {
                  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                  font-size: 85%;
                  background-color: rgba(27, 31, 35, 0.05);
                  padding: 0.2em 0.4em;
                  border-radius: 3px;
                }

                .preview-content img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 4px;
                  margin: 1.5em 0;
                }

                .preview-content hr {
                  height: 1px;
                  background-color: #e1e4e8;
                  border: none;
                  margin: 2em 0;
                }

                .preview-content > *:first-child {
                  margin-top: 0;
                }

                .preview-content > *:last-child {
                  margin-bottom: 0;
                }
              `}
            </style>
            <div
              className="preview-content"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}