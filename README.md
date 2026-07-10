# UMBRAL · Hardcore Extraction Looter

Extraction looter single-player **hardcore** ambientato in un mondo **dark fantasy**, costruito con **Next.js 16 + Three.js (WebGL)** e TypeScript. Combat **turn-based ad azione singola** in stile Stoneshard.

## Caratteristiche

### Sistema di combat turn-based (Stoneshard-style)
- **1 azione per turno**: ogni mossa (movimento, attacco, cura, attesa) fa scattare immediatamente il turno dei nemici
- Decisionalità estrema — ogni scelta conta
- Nemici con AI chase/attack, alcuni con 2 azioni per turno (bestia, boss)

### 5 ere storiche delle armi (15 armi totali)
- **Neolitico**: Coltello di Selce, Ascia di Pietra, Lancia d'Osso
- **Età del Bronzo**: Spada Corta, Mazza, Lancia di Bronzo
- **Età del Ferro**: Spada Lunga, Martello da Guerra, Alabarda
- **Medievale**: Spada del Cavaliere, Ascia Bipenne, Balestra
- **Rinascimentale**: Stocco da Maestro, Zweihänder, Pistola a Pietra

Ogni arma ha danno, portata (in tiles), durabilità, rarità (5 tier), classe (daga/spada/lancia/mazza/martello/alabarda/ranged).

### Meccaniche hardcore extraction
- **Estrazione**: resta fermo sul portale per 3 turni per preservare il bottino
- **Permadeath**: la morte perde TUTTO il bottino trasportato + l'arma equipaggiata
- Stash persistente tra i raid (ma non oltre la morte)
- Sistema XP, livelli, oro, mercante

### Sistema Perks Stoneshard-style
- 4 attributi: Vigor, Agilità, Vitalità, Focus
- 8 perk selezionabili al level-up (3 opzioni casuali)
- Stats derivate: HP massimi, probabilità critico, bonus mischia/distanza

### Dungeon procedurali
- Generatore seeded con stanze random, corridoi L-shape, loop aggiuntivi
- 5 livelli di difficoltà (Profondità Minori → Voragine del Signore)
- Spawn nemici bilanciati, loot casuale, portale di estrazione distante

### Atmosfera dark fantasy
- WebGL con Three.js: nebbia atmosferica, ombre soft, illuminazione dinamica
- Torcia del giocatore con flicker
- Portale di estrazione luminescente
- Palette nero/ambra/rosso, font serif per titoli
- UI completamente in italiano

## Stack tecnologico
- **Framework**: Next.js 16 con App Router
- **Linguaggio**: TypeScript 5
- **3D**: Three.js (WebGL)
- **State**: Zustand
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Icons**: Lucide React

## Struttura del progetto

```
src/
├── app/
│   ├── page.tsx              # Orchestratore fasi di gioco
│   ├── layout.tsx            # Metadata + lang it
│   └── globals.css
├── game/
│   ├── types.ts              # Tipi TypeScript + PERKS + PlayerStats
│   ├── weapons.ts            # Database 15 armi × 5 tier (con apCost)
│   ├── enemies.ts            # 5 nemici + 3 consumabili (con actionsPerTurn)
│   ├── dungeon.ts            # Generatore procedurale seeded
│   └── store.ts              # Zustand store persistente + getDerivedStats
└── components/game/
    ├── GameCanvas.tsx        # Motore WebGL Three.js (turn-based, single action)
    ├── HUD.tsx               # HUD in-game (azione singola, banner turno, log)
    ├── MainMenu.tsx          # Menu principale
    ├── Hub.tsx               # Sanctum con stash/shop/difficoltà/attributi
    ├── PerkModal.tsx         # Modal selezione perk al level-up
    └── EndScreen.tsx         # Schermate morte/estrazione
```

## Controlli
- **WASD / Frecce**: movimento (1 azione)
- **Mouse**: mira
- **Click sinistro**: attacca (1 azione)
- **Spazio**: passa turno
- **Q1 / Q2 / Q3**: usa curativo (1 azione)

## Come avviare
```bash
bun install
bun run dev
```
Apri `http://localhost:3000`

## Bilanciamento turn-based
- Armi classificate per tipo: veloce (1 tile range), media (2 tile range), pesante (3 tile range)
- Coltello di Selce = veloce → 4 attacchi per uccidere un wretch (12 dmg × 4 = 48, wretch ha 40 HP)
- Zweihänder = pesante → 1 colpo devastante (130 dmg)
- Bestia = 2 azioni per turno
- Boss = 2 azioni per turno

## Verifica
- ✅ Lint pulito (0 errori, 0 warning)
- ✅ Testato con Agent Browser: menu → hub → raid → movimento/attacco → kill nemico
- ✅ Sistema ad azione singola: ogni azione trigghera il turno nemico
- ✅ Combat verificato: 4 attacchi a segno → wretch ucciso a T6

## Licenza
Progetto demo educativo.
