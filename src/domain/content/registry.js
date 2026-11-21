const requiredFields = {
  quest: ["id", "type", "title", "giver", "description"],
  item: ["name", "category", "quality"],
  district: ["anchor", "rooms"],
  teachableSkill: ["questId", "moveQuality", "moveType"],
};

const kinds = new Map();

function requireFields(kind, id, def, fields) {
  for (const field of fields) {
    if (def == null || !Object.hasOwn(def, field) || def[field] === undefined) {
      throw new Error(`Content ${kind}/${id}: missing required field "${field}"`);
    }
  }
}

export function define(kind, id, def) {
  if (typeof kind !== "string" || !kind || typeof id !== "string" || !id) {
    throw new Error("Content kind and id must be non-empty strings");
  }
  if (def === null || typeof def !== "object") {
    throw new Error(`Content ${kind}/${id}: definition must be an object`);
  }
  requireFields(kind, id, def, requiredFields[kind] || []);
  if (kind === "residentGroup") {
    if (!Array.isArray(def)) throw new Error(`Content ${kind}/${id}: expected an NPC array`);
    def.forEach((npc, index) => requireFields(kind, `${id}[${index}]`, npc, ["id", "name"]));
  }
  if (!kinds.has(kind)) kinds.set(kind, new Map());
  kinds.get(kind).set(id, def);
  return def;
}

export function load(pack) {
  for (const [kind, entries] of Object.entries(pack)) {
    for (const [id, def] of Object.entries(entries)) define(kind, id, def);
  }
}

export function get(kind, id) {
  return kinds.get(kind)?.get(id);
}

export function all(kind) {
  return [...(kinds.get(kind)?.values() || [])];
}

export function entries(kind) {
  return [...(kinds.get(kind)?.entries() || [])];
}
