/*
  # Initial Folder Structure Setup

  1. Changes
    - Create initial folder structure for IRSST
    - Add proper parent-child relationships
    - Maintain folder hierarchy
  
  2. Security
    - Use existing RLS policies
    - Preserve folder permissions
*/

-- Function to create folder and return its ID
CREATE OR REPLACE FUNCTION create_folder_return_id(
  folder_name text,
  parent_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  folder_id uuid;
BEGIN
  INSERT INTO folders (name, parent_id)
  VALUES (folder_name, parent_id)
  RETURNING id INTO folder_id;
  
  RETURN folder_id;
END;
$$;

-- Clear existing folders to avoid conflicts
DELETE FROM folders;

-- Create root folders
WITH root_folders AS (
  -- IRSST - Interne
  INSERT INTO folders (name, parent_id)
  VALUES ('IRSST - Interne', NULL)
  RETURNING id AS interne_id
),
-- IRSST – Externe Reseau SST
second_root AS (
  INSERT INTO folders (name, parent_id)
  VALUES ('IRSST – Externe Reseau SST', NULL)
  RETURNING id AS externe_sst_id
),
-- IRSST – Externe Reseau Recherche
third_root AS (
  INSERT INTO folders (name, parent_id)
  VALUES ('IRSST – Externe Reseau Recherche', NULL)
  RETURNING id AS externe_recherche_id
),
-- IRSST - Planification stratégique
fourth_root AS (
  INSERT INTO folders (name, parent_id)
  VALUES ('IRSST - Planification stratégique', NULL)
  RETURNING id AS planification_id
),

-- Create first level subfolders for IRSST - Interne
interne_subfolders AS (
  SELECT interne_id FROM root_folders
),
ca AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'CA', interne_id FROM interne_subfolders
  RETURNING id AS ca_id
),
cs AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'CS', interne_id FROM interne_subfolders
  RETURNING id AS cs_id
),
cd AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'CD', interne_id FROM interne_subfolders
  RETURNING id AS cd_id
),
lac AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Lac-à-l''Épaule', interne_id FROM interne_subfolders
),
personnel AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Personnel', interne_id FROM interne_subfolders
  RETURNING id AS personnel_id
),
personnel_recherche AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Personnel de recherche', interne_id FROM interne_subfolders
  RETURNING id AS personnel_recherche_id
),

-- Create subfolders for CA
ca_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, ca.ca_id
  FROM ca,
  (VALUES 
    ('Rencontres individuelles Teams audio'),
    ('Réunions')
  ) AS subfolders(name)
),

-- Create subfolders for CS
cs_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, cs.cs_id
  FROM cs,
  (VALUES 
    ('Rencontres par partie Teams audio'),
    ('Réunions')
  ) AS subfolders(name)
),

-- Create subfolders for CD
cd_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Réunions', cd.cd_id FROM cd
),

-- Create subfolders for Personnel
personnel_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, personnel.personnel_id
  FROM personnel,
  (VALUES 
    ('Demi-journée de réflexion'),
    ('Validation')
  ) AS subfolders(name)
),

-- Create subfolders for Personnel de recherche
personnel_recherche_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Sondage Recrutement recherche', personnel_recherche.personnel_recherche_id
  FROM personnel_recherche
),

-- Create first level subfolders for IRSST – Externe Reseau SST
externe_sst_subfolders AS (
  SELECT externe_sst_id FROM second_root
),
cnesst AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'CNESST', externe_sst_id FROM externe_sst_subfolders
  RETURNING id AS cnesst_id
),
asp AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'ASP', externe_sst_id FROM externe_sst_subfolders
  RETURNING id AS asp_id
),
reseau_sante AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Réseau santé publique', externe_sst_id FROM externe_sst_subfolders
  RETURNING id AS reseau_sante_id
),
tcnsat AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'TCNSAT', externe_sst_id FROM externe_sst_subfolders
  RETURNING id AS tcnsat_id
),
centre_patronal AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Centre patronal SST', externe_sst_id FROM externe_sst_subfolders
  RETURNING id AS centre_patronal_id
),
mutuelles AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Mutuelles de prévention', externe_sst_id FROM externe_sst_subfolders
  RETURNING id AS mutuelles_id
),

-- Create subfolders for CNESST
cnesst_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, cnesst.cnesst_id
  FROM cnesst,
  (VALUES 
    ('Rencontres Teams audio'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for ASP
asp_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, asp.asp_id
  FROM asp,
  (VALUES 
    ('Rencontres Teams audio'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for Réseau santé publique
msss AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'MSSS (Luc Boileau)', reseau_sante.reseau_sante_id
  FROM reseau_sante
  RETURNING id AS msss_id
),
sante_quebec AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Santé Québec', reseau_sante.reseau_sante_id
  FROM reseau_sante
  RETURNING id AS sante_quebec_id
),
inspq AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'INSPQ', reseau_sante.reseau_sante_id
  FROM reseau_sante
  RETURNING id AS inspq_id
),
direction_mtl AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Direction régionale Mtl', reseau_sante.reseau_sante_id
  FROM reseau_sante
  RETURNING id AS direction_mtl_id
),

-- Create subfolders for MSSS
msss_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Rencontre Teams audio', msss.msss_id FROM msss
),

-- Create subfolders for Santé Québec
sante_quebec_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, sante_quebec.sante_quebec_id
  FROM sante_quebec,
  (VALUES 
    ('Rencontre Teams audio'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for INSPQ
inspq_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, inspq.inspq_id
  FROM inspq,
  (VALUES 
    ('Rencontre Teams audio'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for Direction régionale Mtl
direction_mtl_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, direction_mtl.direction_mtl_id
  FROM direction_mtl,
  (VALUES 
    ('Rencontre Teams audio'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for TCNSAT
tcnsat_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, tcnsat.tcnsat_id
  FROM tcnsat,
  (VALUES 
    ('Rencontre Teams audio'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for Centre patronal SST
centre_patronal_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, centre_patronal.centre_patronal_id
  FROM centre_patronal,
  (VALUES 
    ('Rencontres Teams audio'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for Mutuelles de prévention
mutuelles_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, mutuelles.mutuelles_id
  FROM mutuelles,
  (VALUES 
    ('Rencontres Teams audio'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create first level subfolders for IRSST – Externe Reseau Recherche
externe_recherche_subfolders AS (
  SELECT externe_recherche_id FROM third_root
),
communaute_recherche AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Communauté de la recherche externe', externe_recherche_id FROM externe_recherche_subfolders
  RETURNING id AS communaute_id
),
reseau_universites AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Réseau Universités', externe_recherche_id FROM externe_recherche_subfolders
  RETURNING id AS universites_id
),
reseau_instituts AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Réseau des Instituts de recherche en SST', externe_recherche_id FROM externe_recherche_subfolders
  RETURNING id AS instituts_id
),
institutions_gouv AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Institutions gouvernementales', externe_recherche_id FROM externe_recherche_subfolders
  RETURNING id AS institutions_id
),

-- Create subfolders for Communauté de la recherche externe
chercheurs_sub AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Chercheurs subventionnés', communaute_id FROM communaute_recherche
  RETURNING id AS chercheurs_sub_id
),
chercheurs_all AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Chercheurs subventionnés et non subventionnés', communaute_id FROM communaute_recherche
  RETURNING id AS chercheurs_all_id
),

-- Create subfolders for chercheurs subventionnés
chercheurs_sub_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Sondage Recrutement', chercheurs_sub_id FROM chercheurs_sub
),

-- Create subfolders for chercheurs subventionnés et non subventionnés
chercheurs_all_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Sondage Enjeux SST', chercheurs_all_id FROM chercheurs_all
),

-- Create subfolders for Réseau Universités
uq AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'UQ', universites_id FROM reseau_universites
  RETURNING id AS uq_id
),
ets AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'ÉTS', universites_id FROM reseau_universites
  RETURNING id AS ets_id
),

-- Create subfolders for UQ
uq_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Rencontre du 10 avril', uq_id FROM uq
),

-- Create subfolders for ÉTS
ets_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, ets_id
  FROM ets,
  (VALUES 
    ('Rencontres Teams audio'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for Réseau des Instituts
instituts_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Liste d''une vingtaine d''organismes', instituts_id FROM reseau_instituts
  RETURNING id AS liste_id
),
liste_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Documents', liste_id FROM instituts_subfolders
),

-- Create subfolders for Institutions gouvernementales
ministere_travail AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Ministère du travail', institutions_id FROM institutions_gouv
  RETURNING id AS travail_id
),
meie AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'MEIE', institutions_id FROM institutions_gouv
  RETURNING id AS meie_id
),
autres AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Autres', institutions_id FROM institutions_gouv
  RETURNING id AS autres_id
),

-- Create subfolders for Ministère du travail
travail_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, travail_id
  FROM ministere_travail,
  (VALUES 
    ('Rencontre'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for MEIE
meie_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, meie_id
  FROM meie,
  (VALUES 
    ('Rencontre'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for Autres
autres_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, autres_id
  FROM autres,
  (VALUES 
    ('Rencontre'),
    ('Documents')
  ) AS subfolders(name)
),

-- Create subfolders for IRSST - Planification stratégique
planification_subfolders AS (
  SELECT planification_id FROM fourth_root
),
prototype_v1 AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Projet de Prototype Version1', planification_id FROM planification_subfolders
  RETURNING id AS v1_id
),
prototype_v2 AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Projet de Prototype Version2', planification_id FROM planification_subfolders
  RETURNING id AS v2_id
),
prototype_vf AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Prototype VF', planification_id FROM planification_subfolders
  RETURNING id AS vf_id
),
ps_v1 AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Projet PS 2026-2029 V1', planification_id FROM planification_subfolders
  RETURNING id AS ps_v1_id
),
ps_vf AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'PS 2026-2029 VF', planification_id FROM planification_subfolders
),

-- Create subfolders for Prototype V1
v1_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, v1_id
  FROM prototype_v1,
  (VALUES 
    ('Document Prototype V1'),
    ('Consultations : commentaires')
  ) AS subfolders(name)
),

-- Create subfolders for Prototype V2
v2_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, v2_id
  FROM prototype_v2,
  (VALUES 
    ('Document Prototype V2'),
    ('Consultations : commentaires')
  ) AS subfolders(name)
),

-- Create subfolders for Prototype VF
vf_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT 'Document Prototype VF', vf_id FROM prototype_vf
),

-- Create subfolders for PS V1
ps_v1_subfolders AS (
  INSERT INTO folders (name, parent_id)
  SELECT name, ps_v1_id
  FROM ps_v1,
  (VALUES 
    ('Document PS 2026-2029 V1'),
    ('Consultations : commentaires')
  ) AS subfolders(name)
)

SELECT 'Folder structure created successfully' as result;

-- Drop the temporary function
DROP FUNCTION create_folder_return_id(text, uuid);