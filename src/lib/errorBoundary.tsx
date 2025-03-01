import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from './logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  userId?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Composant pour capturer les erreurs React et les enregistrer dans les logs
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Enregistrer l'erreur dans les logs
    logger.error(
      `Erreur React non gérée: ${error.message}`,
      {
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        name: error.name
      },
      'ErrorBoundary',
      this.props.userId
    );

    // Mettre à jour l'état avec les informations d'erreur
    this.setState({ errorInfo });

    // Appeler le callback onError si fourni
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Appeler le callback onReset si fourni
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Afficher le fallback ou un message d'erreur par défaut
      return this.props.fallback || (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg max-w-lg mx-auto my-8">
          <h2 className="text-xl font-medium text-red-800 mb-3">Une erreur s'est produite</h2>
          <div className="bg-white p-4 rounded-md border border-red-100 mb-4 overflow-auto max-h-64">
            <p className="text-red-600 font-medium mb-2">
              {this.state.error?.message || "Une erreur inattendue s'est produite."}
            </p>
            {this.state.errorInfo && (
              <pre className="text-xs text-gray-600 whitespace-pre-wrap mt-2 p-2 bg-gray-50 rounded">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Cette erreur a été enregistrée et sera examinée par notre équipe.
            </p>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}