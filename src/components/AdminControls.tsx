import React, { useState } from 'react';
import { Settings, BarChart2, BookAudioIcon as AudioIcon } from 'lucide-react';
import { TranscriptionDashboard } from './TranscriptionDashboard';

interface AdminControlsProps {
  userId: string;
}

export const AdminControls: React.FC<AdminControlsProps> = ({ userId }) => {
  const [isTranscriptionDashboardOpen, setIsTranscriptionDashboardOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-4 right-4 flex flex-col gap-2">
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
    </>
  );
};