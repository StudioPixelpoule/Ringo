# 🚀 Déploiement de l'Edge Function process-document

## ⚠️ Problème identifié

L'erreur **"Le fichier JSON est invalide"** vient de l'**Edge Function Supabase** `process-document`, pas du code frontend. Cette fonction s'exécute sur les serveurs Supabase et doit être déployée séparément.

## 📋 Étapes pour déployer

### 1. Lier le projet Supabase (si pas déjà fait)

```bash
# Remplacer PROJECT_ID par votre ID de projet (visible dans l'URL Supabase)
supabase link --project-ref PROJECT_ID
```

Votre PROJECT_ID semble être : `kitzhhrhlaevrtbqnbma` 
(basé sur l'URL vue dans les logs : https://kitzhhrhlaevrtbqnbma.supabase.co)

### 2. Déployer la fonction

```bash
# Déployer uniquement la fonction process-document
supabase functions deploy process-document
```

### 3. Si vous n'avez pas accès au CLI Supabase

Si vous ne pouvez pas déployer via CLI, voici les options :

#### Option A : Via le Dashboard Supabase

1. Allez sur https://app.supabase.com
2. Sélectionnez votre projet
3. Allez dans "Edge Functions"
4. Trouvez `process-document`
5. Éditez la fonction avec le nouveau code

#### Option B : Me donner les accès

Si vous pouvez me donner :
- Le PROJECT_ID exact
- Un access token Supabase (temporaire)

Je peux déployer pour vous.

## 📝 Changements dans l'Edge Function

Les modifications apportées :

1. **Nouveau fichier** : `supabase/functions/process-document/jsonUtils.ts`
   - Parse JSON robuste avec multiples fallbacks
   - Support des BOM et caractères spéciaux
   - Gestion des erreurs gracieuse

2. **Modification** : `supabase/functions/process-document/index.ts`
   - Import de `safeJsonParse`
   - Utilisation du parsing robuste au lieu de `JSON.parse` strict
   - Logs améliorés pour le debug

## 🔍 Vérification

Après déploiement, testez :

1. Importez le fichier `bd-commentaires-irsst.json`
2. Vérifiez dans la console qu'il n'y a plus d'erreur 400
3. Le fichier devrait s'importer correctement

## 💡 Alternative temporaire

En attendant le déploiement de l'Edge Function, vous pouvez :

1. **Nettoyer manuellement le JSON** :
   - Ouvrir le fichier dans un éditeur
   - Sauvegarder avec encodage UTF-8 sans BOM
   - Supprimer tout caractère invisible au début

2. **Utiliser un validateur JSON** :
   - https://jsonlint.com/
   - Coller le contenu et valider
   - Copier le JSON validé dans un nouveau fichier

## 🛠️ Debug

Si l'erreur persiste après déploiement :

1. Vérifiez les logs Supabase :
```bash
supabase functions logs process-document
```

2. Ou dans le Dashboard :
   - Edge Functions → process-document → Logs

Les logs montreront :
- `[JSON Processing] Starting processing: filename.json`
- `[JSON Processing] Warning: ...` (si problème de parsing)
- `[JSON Processing] First 100 chars: ...` (début du fichier)

## 📞 Support

Si vous ne pouvez pas déployer vous-même, voici ce dont j'ai besoin :

1. **Project ID** : visible dans l'URL Supabase ou le Dashboard
2. **Méthode préférée** : CLI ou Dashboard
3. **Accès** : Si vous pouvez créer un token temporaire

Le déploiement prend environ 1-2 minutes une fois lancé.
