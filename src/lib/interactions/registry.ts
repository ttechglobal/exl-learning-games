// FILE: src/lib/interactions/registry.ts
// Central registry of all available interaction components.
// Add new components here as they are built.

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  options?: string[];
  default: string | number | boolean;
  description?: string;
}

export interface InteractionDefinition {
  key: string;
  label: string;
  description: string;
  subjects: string[];
  configSchema: ConfigField[];
  buildPrompt: string;
}

export const INTERACTION_REGISTRY: InteractionDefinition[] = [
  {
    key: "HeatSlider",
    label: "Heat Slider",
    description: "Temperature slider that animates particle behaviour across states of matter. Use for: states of matter, changes of state, effect of heat on particle motion, Charles's Law, pressure vs temperature.",
    subjects: ["chemistry", "physics"],
    configSchema: [
      { key: "substanceName",   label: "Substance name",       type: "text",    default: "Water" },
      { key: "startState",      label: "Starting state",       type: "select",  options: ["solid","liquid","gas"], default: "solid" },
      { key: "minTemp",         label: "Min temperature (°C)", type: "number",  default: 0 },
      { key: "maxTemp",         label: "Max temperature (°C)", type: "number",  default: 200 },
      { key: "meltingPoint",    label: "Melting point (°C)",   type: "number",  default: 60 },
      { key: "boilingPoint",    label: "Boiling point (°C)",   type: "number",  default: 120 },
      { key: "particleCount",   label: "Particle count",       type: "number",  default: 24 },
      { key: "showThermometer", label: "Show thermometer",     type: "boolean", default: true },
      { key: "showStateLabel",  label: "Show state label",     type: "boolean", default: true },
      { key: "allowCooling",    label: "Allow cooling",        type: "boolean", default: true },
      { key: "goalTemp",        label: "Goal temperature (°C, 0 = disabled)", type: "number", default: 0 },
    ],
    buildPrompt: "Already built — src/components/interactions/HeatSlider.tsx",
  },

  {
    key: "MatterSorter",
    label: "Matter Sorter",
    description: "Drag-and-drop sorting game. Student sorts items (book, rock, water, air, light, shadow, sound, heat, rainbow) into 'Matter' and 'Not Matter' containers. Mass meter fills as matter is added. Wrong placements trigger a mass+volume check overlay. Use for: defining matter, distinguishing matter from energy/phenomena.",
    subjects: ["chemistry", "physics"],
    configSchema: [
      { key: "showSummaryAtEnd", label: "Show summary when complete", type: "boolean", default: true },
    ],
    buildPrompt: "Already built — src/components/interactions/MatterSorter.tsx",
  },

  {
    key: "AtomReveal",
    label: "Atom Reveal",
    description: "Tap to peel layers off an object (wood, onion, rock) until the atomic structure is revealed. Student taps through material layers, then discovers the atom, taps the nucleus, and taps an electron. Use for: atomic structure, atoms as building blocks of matter, internal structure of atoms.",
    subjects: ["chemistry", "physics"],
    configSchema: [
      { key: "objectName",    label: "Object to peel",       type: "text",   default: "Wood" },
      { key: "coachName",     label: "Coach name",           type: "text",   default: "Adaobi" },
      { key: "electronCount", label: "Number of electrons",  type: "number", default: 3 },
      { key: "accentColour",  label: "Accent colour (hex)",  type: "text",   default: "#00d4ff" },
    ],
    buildPrompt: "Already built — src/components/interactions/AtomReveal.tsx",
  },

  {
    key: "InfiniteZoomExplorer",
    label: "Infinite Zoom Explorer",
    description: "Student selects a material (metal spoon, glass, water, oil, wood, sugar, air) then scrolls/drags to zoom from macroscopic view through to particle level. Shows particle arrangement appropriate to state of matter. Tracks which materials have been explored to particle level. Ends with summary: all matter is made of particles. Use for: particle theory of matter, particle arrangement in solids/liquids/gases, why matter looks smooth at normal scale.",
    subjects: ["chemistry", "physics"],
    configSchema: [
      { key: "autoPlayZoom", label: "Auto-play zoom animation on load", type: "boolean", default: false },
    ],
    buildPrompt: "Already built — src/components/interactions/InfiniteZoomExplorer.tsx",
  },
];

export function getInteraction(key: string): InteractionDefinition | undefined {
  return INTERACTION_REGISTRY.find(i => i.key === key);
}

export function getInteractionsForSubject(subject: string): InteractionDefinition[] {
  return INTERACTION_REGISTRY.filter(i => i.subjects.includes(subject));
}