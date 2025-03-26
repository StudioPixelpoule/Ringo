// Structure des dossiers prédéfinie pour l'IRSST
export const defaultReportFolders = [
  {
    id: 'sst-general',
    name: 'SST Général',
    parent_id: null,
    children: [
      {
        id: 'risk-analysis',
        name: 'Analyse des risques',
        parent_id: 'sst-general'
      },
      {
        id: 'prevention-programs',
        name: 'Programmes de prévention',
        parent_id: 'sst-general'
      },
      {
        id: 'incident-reports',
        name: 'Rapports d\'incidents',
        parent_id: 'sst-general'
      }
    ]
  },
  {
    id: 'ergonomics',
    name: 'Ergonomie',
    parent_id: null,
    children: [
      {
        id: 'workstation-analysis',
        name: 'Analyse de postes',
        parent_id: 'ergonomics'
      },
      {
        id: 'physical-load',
        name: 'Charge physique',
        parent_id: 'ergonomics'
      },
      {
        id: 'musculoskeletal',
        name: 'Troubles musculosquelettiques',
        parent_id: 'ergonomics'
      }
    ]
  },
  {
    id: 'industrial-hygiene',
    name: 'Hygiène industrielle',
    parent_id: null,
    children: [
      {
        id: 'air-quality',
        name: 'Qualité de l\'air',
        parent_id: 'industrial-hygiene'
      },
      {
        id: 'noise-vibration',
        name: 'Bruit et vibrations',
        parent_id: 'industrial-hygiene'
      },
      {
        id: 'chemical-exposure',
        name: 'Exposition chimique',
        parent_id: 'industrial-hygiene'
      }
    ]
  },
  {
    id: 'safety',
    name: 'Sécurité',
    parent_id: null,
    children: [
      {
        id: 'machine-safety',
        name: 'Sécurité des machines',
        parent_id: 'safety'
      },
      {
        id: 'ppe',
        name: 'Équipements de protection',
        parent_id: 'safety'
      },
      {
        id: 'emergency-procedures',
        name: 'Procédures d\'urgence',
        parent_id: 'safety'
      }
    ]
  },
  {
    id: 'psychosocial',
    name: 'Psychosocial',
    parent_id: null,
    children: [
      {
        id: 'stress-management',
        name: 'Gestion du stress',
        parent_id: 'psychosocial'
      },
      {
        id: 'workplace-violence',
        name: 'Violence au travail',
        parent_id: 'psychosocial'
      },
      {
        id: 'mental-health',
        name: 'Santé mentale',
        parent_id: 'psychosocial'
      }
    ]
  },
  {
    id: 'research',
    name: 'Recherche',
    parent_id: null,
    children: [
      {
        id: 'studies',
        name: 'Études scientifiques',
        parent_id: 'research'
      },
      {
        id: 'statistics',
        name: 'Statistiques',
        parent_id: 'research'
      },
      {
        id: 'best-practices',
        name: 'Meilleures pratiques',
        parent_id: 'research'
      }
    ]
  }
];

// Fonction pour initialiser la structure des dossiers
export function initializeReportFolders() {
  const existingFolders = localStorage.getItem('reportFolders');
  if (!existingFolders) {
    // Aplatir la structure hiérarchique en une liste
    const flatFolders = defaultReportFolders.reduce((acc, folder) => {
      acc.push({
        id: folder.id,
        name: folder.name,
        parent_id: folder.parent_id,
        created_at: new Date().toISOString()
      });
      
      folder.children?.forEach(child => {
        acc.push({
          id: child.id,
          name: child.name,
          parent_id: child.parent_id,
          created_at: new Date().toISOString()
        });
      });
      
      return acc;
    }, [] as Array<{
      id: string;
      name: string;
      parent_id: string | null;
      created_at: string;
    }>);

    localStorage.setItem('reportFolders', JSON.stringify(flatFolders));
  }
}