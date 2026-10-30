import type { MaterialClass } from '../../types';
import { tk } from '../../i18n';

/**
 * Finds materials in the text of a supplier invoice, receipt or spec sheet.
 *
 * Rule-based and offline: each line is checked for a known material, a weight
 * and words that say whether it is recycled, reused or certified renewable.
 * Keywords cover the dashboard's six languages. Results are suggestions only:
 * the owner reviews every one before it is added to a product.
 */

export type Confidence = 'high' | 'medium' | 'low';

export interface MaterialSuggestion {
  id: string;
  /** English material name (a translation key); the UI translates it. */
  name: string;
  weightKg: number | null;
  type: MaterialClass | '';
  confidence: Confidence;
  /** The line of the document it was found on. */
  line: string;
}

interface MaterialDef {
  name: string;
  words: string[];
  /** A word that already says the type, e.g. "rPET" is always recycled. */
  implies?: Record<string, MaterialClass>;
}

// Words are written without accents; text is compared accent-free and lower-case.
const MATERIALS: MaterialDef[] = [
  { name: tk('Stainless steel'), words: ['stainless steel', 'acero inoxidable', 'aco inoxidavel', 'acier inoxydable', 'roestvrij staal', 'rvs'] },
  { name: tk('Organic cotton'), words: ['organic cotton', 'algodon organico', 'algodao organico', 'coton biologique', 'coton bio', 'biologisch katoen', 'قطن عضوي'], implies: { '*': 'Renewable' } },
  { name: tk('Cotton'), words: ['cotton', 'algodon', 'algodao', 'coton', 'katoen', 'قطن'] },
  { name: tk('Polyester'), words: ['polyester', 'poliester', 'rpet', 'pet', 'بوليستر'], implies: { rpet: 'Recycled' } },
  { name: tk('Nylon'), words: ['nylon', 'polyamide', 'poliamida', 'econyl', 'نايلون'], implies: { econyl: 'Recycled' } },
  { name: tk('Wool'), words: ['wool', 'merino', 'lana', 'laine', 'wol', 'صوف'] },
  { name: tk('Linen'), words: ['linen', 'flax', 'lino', 'linho', 'linnen', 'كتان'] },
  { name: tk('Hemp'), words: ['hemp', 'canamo', 'canhamo', 'chanvre', 'hennep'] },
  { name: tk('Bamboo'), words: ['bamboo', 'bambu', 'bambou', 'bamboe', 'خيزران'] },
  { name: tk('Lyocell'), words: ['lyocell', 'tencel'] },
  { name: tk('Viscose'), words: ['viscose', 'viscosa', 'rayon'] },
  { name: tk('Silk'), words: ['silk', 'seda', 'soie', 'zijde', 'حرير'] },
  { name: tk('Leather'), words: ['leather', 'cuero', 'couro', 'cuir', 'جلد'] },
  { name: tk('Denim'), words: ['denim', 'jean fabric'] },
  { name: tk('Fabric'), words: ['fabric', 'textile', 'tela', 'tecido', 'tissu', 'stof', 'قماش'] },
  { name: tk('Polyethylene (HDPE/LDPE)'), words: ['hdpe', 'ldpe', 'polyethylene', 'polietileno', 'polyetheen'] },
  { name: tk('Polypropylene'), words: ['polypropylene', 'polipropileno', 'polypropeen'] },
  { name: tk('Plastic'), words: ['plastic', 'plastico', 'plastique', 'kunststof', 'plastiek', 'بلاستيك'] },
  { name: tk('Aluminium'), words: ['aluminium', 'aluminum', 'aluminio', 'ألمنيوم', 'ألومنيوم'] },
  { name: tk('Steel'), words: ['steel', 'acero', 'acier', 'staal', 'فولاذ'] },
  { name: tk('Copper'), words: ['copper', 'cobre', 'cuivre', 'koper', 'نحاس'] },
  { name: tk('Brass'), words: ['brass', 'laton', 'latao', 'laiton', 'messing'] },
  { name: tk('Glass'), words: ['glass', 'vidrio', 'vidro', 'verre', 'glas', 'زجاج'] },
  { name: tk('Cardboard'), words: ['cardboard', 'corrugated', 'kraft', 'carton', 'papelao', 'karton', 'كرتون'] },
  { name: tk('Paper'), words: ['paper', 'papel', 'papier', 'ورق'] },
  { name: tk('Wood'), words: ['wood', 'timber', 'plywood', 'madera', 'madeira', 'bois', 'hout', 'خشب'] },
  { name: tk('Cork'), words: ['cork', 'corcho', 'cortica', 'liege', 'kurk'] },
  { name: tk('Rubber'), words: ['rubber', 'caucho', 'borracha', 'caoutchouc', 'مطاط'] },
  { name: tk('Silicone'), words: ['silicone', 'silicona'] },
  { name: tk('Wax'), words: ['beeswax', 'soy wax', 'wax', 'cera', 'cire'] },
  { name: tk('Ceramic'), words: ['ceramic', 'stoneware', 'clay', 'ceramica', 'ceramique', 'keramiek', 'سيراميك'] },
];

const QUALIFIERS: [MaterialClass, string[]][] = [
  // Reused first: "reclaimed recycled-look fabric" is reused, not recycled.
  ['Reused', ['reused', 'reuse', 'reclaimed', 'salvaged', 'second hand', 'second-hand', 'secondhand', 'deadstock', 'upcycled', 'offcut', 'offcuts', 'surplus', 'vintage', 'reutilizado', 'reutilizada', 'recuperado', 'recuperada', 'segunda mano', 'reaproveitado', 'reaproveitada', 'reutilise', 'reutilisee', 'reemploi', 'seconde main', 'hergebruikt', 'tweedehands', 'معاد استخدامه', 'مستعمل']],
  ['Recycled', ['recycled', 'post consumer', 'post-consumer', 'postconsumer', 'pcr', 'regenerated', 'reciclado', 'reciclada', 'reciclados', 'recicladas', 'recycle', 'recyclee', 'gerecycled', 'gerecycleerd', 'معاد تدويره', 'معاد التدوير']],
  ['Renewable', ['organic', 'fsc', 'pefc', 'gots', 'certified', 'bio-based', 'biobased', 'organico', 'organica', 'certificado', 'certificada', 'biologique', 'certifie', 'certifiee', 'biologisch', 'gecertificeerd', 'عضوي']],
  ['Virgin', ['virgin', 'virgen', 'virgem', 'vierge', 'بكر']],
];

const RECYCLED_WORDS = QUALIFIERS.find(([c]) => c === 'Recycled')![1];

// kg per unit
const UNITS: Record<string, number> = {
  kg: 1, kgs: 1, kilo: 1, kilos: 1, kilogram: 1, kilograms: 1, kilogramos: 1, kilogrammes: 1, kilogramas: 1, كغ: 1, كجم: 1,
  g: 0.001, gr: 0.001, gram: 0.001, grams: 0.001, gramos: 0.001, gramas: 0.001, grammes: 0.001, غ: 0.001,
  // A bare "t" is left out: "2 t-shirts" is not two tonnes.
  tonne: 1000, tonnes: 1000, ton: 1000, tons: 1000, toneladas: 1000,
  lb: 0.45359237, lbs: 0.45359237, pound: 0.45359237, pounds: 0.45359237,
  oz: 0.028349523,
};

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A whole word or phrase: not inside a longer word, in any script.
const wordRe = (words: string[]) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(${[...words].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

const MATERIAL_RES = MATERIALS.map((m) => ({ def: m, re: wordRe(m.words) }));
const QUALIFIER_RES = QUALIFIERS.map(([cls, words]) => ({ cls, re: wordRe(words) }));
const UNIT_NAMES = Object.keys(UNITS).sort((a, b) => b.length - a.length).map(escape).join('|');
const WEIGHT_RE = new RegExp(`(\\d+(?:[.,]\\d+)*)\\s*(${UNIT_NAMES})(?![\\p{L}\\p{N}])`, 'giu');
const PCT_RE = new RegExp(`(\\d{1,3}(?:[.,]\\d+)?)\\s*%\\s*(?:of\\s+)?(${RECYCLED_WORDS.map(escape).join('|')})|(${RECYCLED_WORDS.map(escape).join('|')})(?:\\s+content)?\\s*:?\\s*(\\d{1,3}(?:[.,]\\d+)?)\\s*%`, 'iu');

/** "1,5" and "1.5" are 1.5; "1,000" and "1.000,5" use the first mark for thousands. */
export function parseNumber(raw: string): number {
  const marks = raw.match(/[.,]/g) ?? [];
  if (marks.length === 0) return Number(raw);
  const last = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  const decimals = raw.length - last - 1;
  // A single mark followed by exactly three digits is a thousands separator.
  if (marks.length === 1 && decimals === 3) return Number(raw.replace(/[.,]/g, ''));
  return Number(raw.slice(0, last).replace(/[.,]/g, '') + '.' + raw.slice(last + 1));
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function weightIn(line: string): number | null {
  for (const m of line.matchAll(WEIGHT_RE)) {
    const kg = parseNumber(m[1]) * UNITS[m[2].toLowerCase()];
    // Only the first weight on a line: later ones are usually per-unit or totals.
    if (Number.isFinite(kg) && kg > 0) return round(kg);
  }
  return null;
}

function typeIn(line: string, matchedWord: string, def: MaterialDef): MaterialClass | '' {
  const implied = def.implies?.[matchedWord] ?? def.implies?.['*'];
  for (const { cls, re } of QUALIFIER_RES) {
    re.lastIndex = 0;
    if (re.test(line)) return cls;
  }
  return implied ?? '';
}

function recycledShare(line: string): number | null {
  const m = line.match(PCT_RE);
  if (!m) return null;
  const pct = parseNumber(m[1] ?? m[4]);
  return pct > 0 && pct <= 100 ? pct : null;
}

export function parseMaterials(text: string): MaterialSuggestion[] {
  const found: Omit<MaterialSuggestion, 'id'>[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.length < 3) continue;
    const p = plain(line);
    // Take the most specific material on the line ("stainless steel" over "steel").
    let best: { def: MaterialDef; word: string } | null = null;
    for (const { def, re } of MATERIAL_RES) {
      re.lastIndex = 0;
      const m = re.exec(p);
      if (m && (!best || m[1].length > best.word.length)) best = { def, word: m[1] };
    }
    if (!best) continue;

    const weightKg = weightIn(p);
    const share = recycledShare(p);
    let type = typeIn(p, best.word, best.def);
    const hasQualifier = type !== '';
    const confidence: Confidence = weightKg !== null && hasQualifier ? 'high' : weightKg !== null || hasQualifier ? 'medium' : 'low';

    if (share !== null && share < 100) {
      // "30% recycled": split into the recycled part and the rest.
      if (weightKg !== null) {
        found.push({ name: best.def.name, weightKg: round((weightKg * share) / 100), type: 'Recycled', confidence, line });
        found.push({ name: best.def.name, weightKg: round((weightKg * (100 - share)) / 100), type: 'Virgin', confidence, line });
        continue;
      }
      type = share >= 50 ? 'Recycled' : 'Virgin';
    }
    found.push({ name: best.def.name, weightKg, type, confidence: share !== null && weightKg === null ? 'low' : confidence, line });
  }

  // The same material and type found twice (e.g. two deliveries) is added up.
  const merged: MaterialSuggestion[] = [];
  for (const f of found) {
    const same = merged.find((m) => m.name === f.name && m.type === f.type && m.weightKg !== null && f.weightKg !== null);
    if (same) {
      same.weightKg = round(same.weightKg! + f.weightKg!);
      if (f.confidence === 'low' || same.confidence === 'low') same.confidence = 'low';
      else if (f.confidence === 'medium') same.confidence = 'medium';
    } else merged.push({ ...f, id: `s${merged.length}` });
  }
  return merged;
}
