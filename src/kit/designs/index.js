import { SIGNATURE } from './signature.js';
import { HORIZON } from './horizon.js';
import { VERTEX } from './vertex.js';
import { LUMEN } from './lumen.js';
import { NOVA } from './nova.js';
import { CREST } from './crest.js';
import { HARBOR } from './harbor.js';
import { OPERATOR } from './operator.js';
import { ATLAS } from './atlas.js';
import { MERIDIAN } from './meridian.js';

// The designs that have layouts of their own: every one of them brings its hero, its layouts for each kind of section, its header and its
// footer, so no two of them share a layout. Listed in the order the designs are shown.
const ALL = [SIGNATURE, HORIZON, VERTEX, LUMEN, NOVA, CREST, HARBOR, OPERATOR, ATLAS, MERIDIAN];

export const NEW_DESIGNS = Object.fromEntries(ALL.map((d) => [d.design.id, d.design]));
export const NEW_HERO = Object.assign({}, ...ALL.map((d) => d.hero));
export const NEW_LIBRARY = {};
for (const d of ALL) for (const [role, variants] of Object.entries(d.library)) NEW_LIBRARY[role] = { ...(NEW_LIBRARY[role] || {}), ...variants };
export const NEW_HEADER = Object.assign({}, ...ALL.map((d) => d.header));
export const NEW_FOOTER = Object.assign({}, ...ALL.map((d) => d.footer));
// a design that draws the website's own sections itself: by the prefix of its layout names, a renderer for each kind of section
export const NEW_TYPED = Object.fromEntries(ALL.filter((d) => d.typed).map((d) => [d.design.prefix, d.typed]));
