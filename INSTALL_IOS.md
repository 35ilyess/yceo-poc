# Installer l'app sur iPhone (iOS 26.3) — sans Mac récent

Ton MacBook Air 2017 ne peut pas faire tourner Xcode 26 (requis pour iOS 26).
On compile donc **dans le cloud** (gratuit, GitHub Actions), puis on installe le
`.ipa` sur l'iPhone avec un **Apple ID gratuit** via AltStore ou Sideloadly.

> Le `.ipa` produit est **non signé** : AltStore / Sideloadly le signent eux-mêmes
> avec ton Apple ID gratuit. Validité 7 jours, renouvelée automatiquement (AltStore)
> ou à refaire manuellement (Sideloadly). Dans l'UE, **AltStore PAL** offre une
> validité plus longue.

## Étape 1 — Mettre le projet sur GitHub

Depuis le dossier du projet :

```bash
git init
git add .
git commit -m "Ycéo POC"
git branch -M main
# crée un dépôt vide sur github.com puis :
git remote add origin https://github.com/<ton-compte>/yceo-poc.git
git push -u origin main
```

## Étape 2 — Lancer le build cloud

1. Sur GitHub, onglet **Actions** → workflow **« Build iOS IPA (unsigned) »** → **Run workflow**.
2. ~10–15 min plus tard, ouvrir le run terminé → section **Artifacts** → télécharger
   **`YceoPOC-unsigned-ipa`** (un `.zip` contenant `YceoPOC-unsigned.ipa`).

> Le build tourne sur un Mac macOS 15 + Xcode récent fourni par GitHub. Un `.ipa`
> compilé ainsi s'installe et fonctionne sur iOS 26.3.

## Étape 3 — Installer sur l'iPhone

### Option A — Sideloadly (simple, USB)
1. Installer **Sideloadly** (sideloadly.io) sur le Mac (fonctionne sur Ventura).
2. Brancher l'iPhone en USB, ouvrir Sideloadly.
3. Glisser le `.ipa`, entrer ton **Apple ID** (un identifiant dédié est conseillé).
4. Installer. Sur l'iPhone : **Réglages → Général → VPN et gestion de l'appareil →
   faire confiance** à ton profil développeur.
5. Refaire tous les 7 jours (ou activer le rappel).

### Option B — AltStore (renouvellement auto)
1. Installer **AltServer** (altstore.io) sur le Mac + l'app **AltStore** sur l'iPhone.
2. Dans AltStore → **My Apps → +** → choisir le `.ipa`.
3. AltServer resigne automatiquement tous les 7 jours tant que le Mac et l'iPhone
   sont sur le même Wi-Fi de temps en temps.
4. **UE :** **AltStore PAL** (marketplace alternatif autorisé par le DMA) permet une
   validité plus longue et se passe d'AltServer.

## Alternative — TestFlight (si tu prends l'Apple Developer Program, 99 $/an)
Plus confortable (pas de renouvellement 7 jours, installable par d'autres) :
- Ajouter une **clé API App Store Connect** dans les *Secrets* GitHub, configurer la
  signature dans le workflow, puis publier sur **TestFlight**.
- Je peux adapter le workflow pour ça si tu franchis le pas.

## Mettre à jour l'app plus tard
Après toute modif : `git push` (ou un tag `vX`), relancer le workflow Actions,
retélécharger le `.ipa`, réinstaller via Sideloadly/AltStore.
