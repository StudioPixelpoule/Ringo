import React, { useState } from 'react';
import { BookAudioIcon as AudioIcon, AlertCircle, Users } from 'lucide-react';
import { TranscriptionDashboard } from './TranscriptionDashboard';
import { LogsPanel } from './LogsPanel';
import { UserManagementPanel } from './UserManagementPanel';

interface AdminControlsProps {
  userId: string;
}

export const AdminControls: React.FC<AdminControlsProps> = ({ userId }) => {
  const [isTranscriptionDashboardOpen, setIsTranscriptionDashboardOpen] = useState(false);
  const [isLogsPanelOpen, setIsLogsPanelOpen] = useState(false);
  const [isUserManagementPanelOpen, setIsUserManagementPanelOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setIsUserManagementPanelOpen(true)}
          className="p-3 bg-[#f15922] text-white rounded-full shadow-lg hover:bg-[#d14811] transition-all"
          title="Gestion des utilisateurs"
        >
          <Users size={20} />
        </button>
        <button
          onClick={() => setIsLogsPanelOpen(true)}
          className="p-3 bg-[#f15922] text-white rounded-full shadow-lg hover:bg-[#d14811] transition-all"
          title="Logs & Erreurs"
        >
          <AlertCircle size={20} />
        </button>
        <button
          onClick={() => setIsTranscriptionDashboardOpen(true)}
          className="p-3 bg-[#f15922] text-white rounded-full shadow-lg hover:bg-[#d14811] transition-all"
          title="Tableau de bord des transcriptions"
        >
          <AudioIcon size={20} />
        </button>
      </div>

      <TranscriptionDashboard
        isOpen={isTranscriptionDashboardOpen}
        onClose={() => setIsTranscriptionDashboardOpen(false)}
        userId={userId}
      />

      <LogsPanel
        isOpen={isLogsPanelOpen}
        onClose={() => setIsLogsPanelOpen(false)}
        userId={userId}
      />

      <UserManagementPanel
        isOpen={isUserManagementPanelOpen}
        onClose={() => setIsUserManagementPanelOpen(false)}
        userId={userId}
      />
    </>
  );
};