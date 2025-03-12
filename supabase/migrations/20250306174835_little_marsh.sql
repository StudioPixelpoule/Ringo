/*
  # Create Report Templates

  1. New Templates
    - Creates initial report templates with optimized prompts
    - Each template has a specific focus and structure
    - Prompts are designed for GPT-4 with clear instructions

  2. Template Types
    - Comparative Analysis
    - Strategic Summary
    - Decision Support
    - Group-focused Analysis
    - Comprehensive Review
*/

-- Insert report templates
INSERT INTO report_templates (title, prompt, usage_count) VALUES
(
  'Rapport comparatif détaillé',
  'Réalise une analyse comparative approfondie des documents en suivant ces directives :

OBJECTIF : Identifier et comparer les différentes perspectives et approches en matière de Santé et Sécurité au Travail (SST).

STRUCTURE ATTENDUE :

## Introduction
- Présente le contexte de l''analyse
- Identifie les groupes ou documents comparés
- Expose clairement les objectifs de la comparaison

## Analyse
- Compare méthodiquement les approches et points de vue
- Identifie les convergences et divergences majeures
- Évalue la pertinence des différentes positions
- Analyse les implications pratiques

## Points Clés
- Synthétise les principales découvertes
- Met en évidence les tendances significatives
- Souligne les aspects critiques à retenir

## Recommandations
- Propose des actions concrètes basées sur l''analyse
- Suggère des pistes d''harmonisation
- Identifie les meilleures pratiques à adopter

## Conclusion
- Résume les enseignements principaux
- Offre une perspective d''ensemble
- Propose des orientations futures

CONSIGNES SPÉCIFIQUES :
- Ton professionnel et objectif
- Formulation claire et précise
- Focus sur les implications pratiques
- Recommandations actionnables',
  0
),
(
  'Synthèse stratégique SST',
  'Élabore une synthèse stratégique des enjeux SST en suivant ces directives :

OBJECTIF : Fournir une vision stratégique claire des enjeux de Santé et Sécurité au Travail pour la prise de décision.

STRUCTURE ATTENDUE :

## Introduction
- Contextualise les enjeux SST
- Définit la portée de l''analyse
- Présente les objectifs stratégiques

## Analyse
- Évalue les enjeux stratégiques majeurs
- Analyse les impacts organisationnels
- Identifie les opportunités et risques
- Examine les ressources nécessaires

## Points Clés
- Liste les éléments stratégiques essentiels
- Identifie les facteurs de succès
- Souligne les points d''attention critiques

## Recommandations
- Propose des orientations stratégiques claires
- Suggère des actions prioritaires
- Définit des indicateurs de suivi

## Conclusion
- Synthétise les orientations principales
- Rappelle les priorités d''action
- Projette les perspectives futures

CONSIGNES SPÉCIFIQUES :
- Style direct et synthétique
- Focus sur les implications stratégiques
- Recommandations hiérarchisées
- Vision à long terme',
  0
),
(
  'Rapport d''aide à la décision',
  'Produis un rapport d''aide à la décision en suivant ces directives :

OBJECTIF : Fournir une analyse structurée pour éclairer les décisions stratégiques en matière de SST.

STRUCTURE ATTENDUE :

## Introduction
- Présente le contexte décisionnel
- Définit les enjeux clés
- Expose les objectifs de l''analyse

## Analyse
- Évalue les options disponibles
- Analyse les impacts potentiels
- Examine les contraintes et opportunités
- Évalue les risques associés

## Points Clés
- Identifie les critères de décision cruciaux
- Souligne les avantages et inconvénients
- Met en évidence les facteurs déterminants

## Recommandations
- Propose des options privilégiées
- Suggère un plan d''action détaillé
- Identifie les conditions de succès

## Conclusion
- Synthétise les choix recommandés
- Rappelle les points décisifs
- Propose un calendrier d''action

CONSIGNES SPÉCIFIQUES :
- Argumentation factuelle
- Évaluation objective des options
- Recommandations pragmatiques
- Focus sur l''opérationnalisation',
  0
),
(
  'Rapport ciblé par groupe',
  'Réalise une analyse ciblée par groupe en suivant ces directives :

OBJECTIF : Analyser et comparer les perspectives spécifiques des différents groupes consultés en matière de SST.

STRUCTURE ATTENDUE :

## Introduction
- Identifie les groupes concernés
- Présente le contexte de l''analyse
- Définit les objectifs de la comparaison

## Analyse
- Examine les perspectives par groupe
- Compare les priorités identifiées
- Analyse les points de convergence
- Évalue les divergences significatives

## Points Clés
- Synthétise les positions principales
- Identifie les tendances communes
- Souligne les différences majeures

## Recommandations
- Propose des approches adaptées
- Suggère des points de compromis
- Identifie les actions prioritaires

## Conclusion
- Résume les positions clés
- Propose des pistes d''harmonisation
- Suggère des étapes suivantes

CONSIGNES SPÉCIFIQUES :
- Respect des perspectives
- Analyse équilibrée
- Recommandations consensuelles
- Focus sur la collaboration',
  0
),
(
  'Analyse globale SST',
  'Réalise une analyse globale des enjeux SST en suivant ces directives :

OBJECTIF : Fournir une vision complète et approfondie des enjeux de Santé et Sécurité au Travail.

STRUCTURE ATTENDUE :

## Introduction
- Présente le contexte général
- Définit la portée de l''analyse
- Expose les objectifs globaux

## Analyse
- Examine les dimensions clés
- Évalue les enjeux transversaux
- Analyse les interactions
- Identifie les tendances majeures

## Points Clés
- Synthétise les éléments essentiels
- Met en évidence les priorités
- Souligne les interconnexions

## Recommandations
- Propose des actions systémiques
- Suggère des approches intégrées
- Définit des priorités d''action

## Conclusion
- Résume la vision globale
- Rappelle les points essentiels
- Propose des perspectives d''évolution

CONSIGNES SPÉCIFIQUES :
- Vision holistique
- Analyse systémique
- Recommandations intégrées
- Perspective long terme',
  0
);