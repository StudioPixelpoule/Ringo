import React, { useState, useEffect } from 'react';
import { Key, Check, AlertCircle, Loader2 } from 'lucide-react';

interface OpenAIKeyFormProps {
  onSave: (apiKey: string) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const OpenAIKeyForm: React.FC<OpenAIKeyFormProps> = ({ onSave, onCancel, isSaving = false }) => {
  const [apiKey, setApiKey] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentKey, setCurrentKey] = useState<string | null>(null);

  // Récupérer la clé API actuelle depuis localStorage ou les variables d'environnement
  useEffect(() => {
    const storedKey = localStorage.getItem('openai-api-key');
    if (storedKey) {
      setCurrentKey(storedKey);
      return;
    }

    const envKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (envKey && envKey !== 'dummy-key' && envKey !== 'your-openai-api-key-here') {
      setCurrentKey(envKey);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Vérification simple du format de la clé
    if (!apiKey.trim()) {
      setError('Veuillez entrer une clé API');
      return;
    }
    
    if (!apiKey.startsWith('sk-')) {
      setError('La clé API doit commencer par "sk-"');
      return;
    }
    
    // Considérer la clé comme valide et la sauvegarder
    setIsValid(true);
    onSave(apiKey);
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
      <div className="flex items-center mb-6">
        <div className="bg-[#f15922] p-3 rounded-full mr-4">
          <Key className="text-white" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Configuration de l'API OpenAI</h2>
          <p className="text-gray-600 text-sm">Entrez votre clé API pour activer les fonctionnalités d'IA</p>
        </div>
      </div>

      {currentKey && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-md">
          <div className="flex items-start">
            <Check className="text-green-500 mr-2 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-green-700 font-medium">Une clé API est déjà configurée</p>
              <p className="text-green-600 text-sm mt-1">
                Vous pouvez la remplacer en entrant une nouvelle clé ci-dessous.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-md">
          <div className="flex items-start">
            <AlertCircle className="text-red-500 mr-2 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-red-700 font-medium">Erreur de validation</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
            Clé API OpenAI
          </label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              if (e.target.value.trim() && e.target.value.startsWith('sk-')) {
                setIsValid(true);
                setError(null);
              } else {
                setIsValid(false);
              }
            }}
            placeholder="sk-..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f15922] focus:border-transparent transition-all"
            required
            disabled={isSaving}
          />
          <p className="mt-2 text-sm text-gray-500">
            Vous pouvez obtenir votre clé API sur{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f15922] hover:underline"
            >
              platform.openai.com/api-keys
            </a>
          </p>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={isSaving}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`
              px-4 py-2 text-white rounded-lg transition-colors flex items-center justify-center
              ${isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-[#f15922] hover:bg-[#d14811]'}
              ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}
            `}
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};