# Configuration des Variables d'Environnement

## ⚠️ Sécurité Importante

**NE JAMAIS** mettre la clé API OpenAI dans les variables d'environnement côté client !

## Variables Client (.env)

```bash
# Configuration Supabase
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-publique-supabase
```

## Configuration OpenAI (Côté Serveur Uniquement)

La clé OpenAI doit être configurée dans les Edge Functions Supabase :

### Via Dashboard Supabase

1. Connectez-vous à votre [dashboard Supabase](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **Edge Functions** → **Secrets**
4. Ajoutez la variable : `OPENAI_API_KEY = sk-...`

### Via CLI Supabase

```bash
supabase secrets set OPENAI_API_KEY=sk-votre-clé --project-ref votre-ref-projet
```

## Vérification

Pour vérifier que tout est configuré correctement :

1. Les Edge Functions doivent pouvoir accéder à `OPENAI_API_KEY`
2. Le client ne doit PAS avoir accès à cette clé
3. Toutes les fonctionnalités IA doivent passer par les Edge Functions

## Migration depuis l'ancienne configuration

Si vous aviez `VITE_OPENAI_API_KEY` dans votre `.env` :

1. **Supprimez** cette ligne de votre fichier `.env`
2. Configurez la clé dans Supabase comme indiqué ci-dessus
3. Redémarrez votre application 