# Améliorations de l'Homogénéité Graphique

## 🎨 Charte Graphique du Projet

### Couleurs Principales
- **Orange principal** : `#f15922` (headers, boutons primaires, accents)
- **Orange secondaire** : `#dba747` (titres H2, accents secondaires)
- **Orange hover** : `#d94d1a` (état hover des boutons)
- **Gris foncé** : `#333`, `#666`, `#777` (textes)
- **Gris clair** : `#f8f9fa`, `#e9ecef` (fonds)
- **Blanc** : backgrounds principaux

### Structure des Modales
```
fixed inset-0 bg-black/50              // Overlay sombre
bg-white rounded-xl shadow-xl          // Modale principale
bg-[#f15922] px-6 py-4                 // Header orange
text-xl font-semibold text-white       // Titre du header
header-neumorphic-button               // Boutons dans le header
```

## 📝 Modifications Apportées

### 1. Notification de Limite de Documents

**Avant** : Utilisation de `alert()` natif du navigateur
```javascript
alert(`Vous ne pouvez sélectionner que ${maxSelectableDocuments} document(s)...`);
```

**Après** : Modale personnalisée cohérente
- Nouveau composant `LimitNotification.tsx`
- Header orange avec icône `AlertTriangle`
- Animation d'entrée fluide (motion)
- Bouton "Compris" aux couleurs du projet
- Icône dans un cercle orange clair

### 2. Avertissement d'Inactivité

**Avant** : Design inconsistant
- Bordure orange épaisse
- Pas de header distinct
- Couleurs non harmonisées

**Après** : Design cohérent
- Header orange comme toutes les modales
- Icône `Clock` dans le header
- Bouton neumorphique pour fermer
- Barre de progression orange principale
- Animation motion au lieu de CSS

### Détails Techniques

#### Structure Cohérente
```tsx
// Header standard pour toutes les modales
<div className="bg-[#f15922] px-6 py-4 flex items-center justify-between">
  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
    <Icon size={24} />
    Titre
  </h2>
  <button className="header-neumorphic-button w-8 h-8 rounded-full">
    <X size={20} />
  </button>
</div>
```

#### Boutons Primaires
```tsx
className="px-4 py-2 bg-[#f15922] text-white rounded-lg hover:bg-[#d94d1a] transition-colors font-medium"
```

#### Icônes d'Alerte
```tsx
// Conteneur rond avec fond coloré
<div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
  <Icon className="text-[#f15922]" size={24} />
</div>
```

## ✅ Bénéfices

1. **Cohérence Visuelle** : Toutes les modales suivent la même structure
2. **Expérience Utilisateur** : Interactions fluides et prévisibles
3. **Accessibilité** : Boutons et textes bien contrastés
4. **Modernité** : Animations motion et design neumorphique
5. **Maintenabilité** : Code réutilisable et patterns clairs

## 🔍 Points d'Attention

- Toujours utiliser les couleurs de la charte (`#f15922`, `#dba747`)
- Respecter la structure header/body pour les modales
- Utiliser `header-neumorphic-button` pour les boutons du header
- Préférer motion/framer-motion pour les animations
- Garder des espacements cohérents (`p-6` pour le body, `px-6 py-4` pour le header)

Le projet maintient maintenant une identité visuelle forte et cohérente à travers tous ses composants. 