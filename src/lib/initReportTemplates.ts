import { createReportTemplate } from './reportTemplateService';

export async function initDefaultTemplates() {
  const defaultTemplates = [
    {
      name: 'Résumé Exécutif',
      description: 'Synthèse concise des points clés et conclusions principales',
      icon: 'FileText',
      type: 'summary',
      prompt: `Génère un résumé exécutif à partir des documents fournis.

OBJECTIF : Fournir une synthèse claire et concise des informations essentielles.

STRUCTURE ATTENDUE :

## Introduction
- Contexte et objectifs
- Documents analysés
- Approche méthodologique

## Points Clés
- Synthèse des éléments essentiels (3-5 points)
- Faits marquants
- Données significatives

## Conclusions
- Principales conclusions
- Implications majeures
- Points d'attention

## Recommandations
- Actions prioritaires (3-5 maximum)
- Prochaines étapes suggérées
- Points de vigilance`,
      structure: {
        sections: [
          { title: 'Introduction', required: true },
          { title: 'Points Clés', required: true },
          { title: 'Conclusions', required: true },
          { title: 'Recommandations', required: true }
        ]
      },
      is_active: true
    },
    {
      name: 'Analyse Approfondie',
      description: 'Analyse détaillée avec sections et interprétations',
      icon: 'FileSearch',
      type: 'analysis',
      prompt: `Réalise une analyse approfondie des documents fournis.

OBJECTIF : Fournir une analyse détaillée et structurée du contenu.

STRUCTURE ATTENDUE :

## Introduction
- Contexte détaillé
- Objectifs de l'analyse
- Méthodologie employée

## Analyse Détaillée
- Examen approfondi du contenu
- Points critiques identifiés
- Arguments principaux
- Données et preuves

## Implications
- Impact sur les processus
- Conséquences potentielles
- Opportunités identifiées
- Risques à considérer

## Recommandations
- Actions prioritaires
- Solutions proposées
- Plan de mise en œuvre
- Indicateurs de suivi

## Conclusion
- Synthèse de l'analyse
- Points d'action clés
- Perspectives futures`,
      structure: {
        sections: [
          { title: 'Introduction', required: true },
          { title: 'Analyse Détaillée', required: true },
          { title: 'Implications', required: true },
          { title: 'Recommandations', required: true },
          { title: 'Conclusion', required: true }
        ]
      },
      is_active: true
    },
    {
      name: 'Comparaison de Documents',
      description: 'Mise en parallèle des similarités et différences',
      icon: 'FileSpreadsheet',
      type: 'comparison',
      prompt: `Compare et contraste les documents fournis.

OBJECTIF : Identifier et analyser les similitudes et différences entre les documents.

STRUCTURE ATTENDUE :

## Introduction
- Présentation des documents
- Objectifs de la comparaison
- Critères d'analyse

## Points Communs
- Thèmes partagés
- Approches similaires
- Conclusions convergentes

## Différences
- Divergences majeures
- Approches distinctes
- Points de désaccord

## Analyse Comparative
- Évaluation des approches
- Forces et faiblesses
- Complémentarités potentielles

## Recommandations
- Meilleures pratiques à retenir
- Points d'harmonisation
- Actions suggérées

## Conclusion
- Synthèse comparative
- Points clés à retenir
- Perspectives d'intégration`,
      structure: {
        sections: [
          { title: 'Introduction', required: true },
          { title: 'Points Communs', required: true },
          { title: 'Différences', required: true },
          { title: 'Analyse Comparative', required: true },
          { title: 'Recommandations', required: true },
          { title: 'Conclusion', required: true }
        ]
      },
      is_active: true
    },
    {
      name: 'Extraction de Données',
      description: 'Exportation des données structurées en format tabulaire',
      icon: 'BarChart',
      type: 'extraction',
      prompt: `Extrais et structure les données clés des documents fournis.

OBJECTIF : Identifier et organiser les données importantes en format structuré.

STRUCTURE ATTENDUE :

## Introduction
- Contexte de l'extraction
- Types de données recherchées
- Méthodologie d'extraction

## Données Extraites
- Chiffres clés
- Statistiques importantes
- Métriques principales
- Données temporelles

## Analyse des Données
- Tendances identifiées
- Corrélations observées
- Points remarquables
- Anomalies détectées

## Visualisation
- Tableaux récapitulatifs
- Structures identifiées
- Hiérarchies de données
- Relations clés

## Recommandations
- Utilisation suggérée
- Points d'attention
- Analyses complémentaires

## Conclusion
- Synthèse des données
- Points clés à retenir
- Prochaines analyses suggérées`,
      structure: {
        sections: [
          { title: 'Introduction', required: true },
          { title: 'Données Extraites', required: true },
          { title: 'Analyse des Données', required: true },
          { title: 'Visualisation', required: true },
          { title: 'Recommandations', required: true },
          { title: 'Conclusion', required: true }
        ]
      },
      is_active: true
    }
  ];

  for (const template of defaultTemplates) {
    try {
      await createReportTemplate(template);
      console.log(`✅ Template créé: ${template.name}`);
    } catch (error) {
      console.error(`❌ Erreur lors de la création du template ${template.name}:`, error);
    }
  }

  console.log('✨ Initialisation des modèles de rapports terminée');
}