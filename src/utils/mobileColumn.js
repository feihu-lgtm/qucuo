export const MOBILE_COLUMN_KEY = "qucuo_mobile_column";
const valid = value => ["left", "center", "right"].includes(value);

export function readMobileColumn(storage) {
  try {
    const value = (storage ?? globalThis.localStorage).getItem(MOBILE_COLUMN_KEY);
    return valid(value) ? value : "center";
  } catch { return "center"; }
}

export function writeMobileColumn(storage, value) {
  try {
    (storage ?? globalThis.localStorage).setItem(MOBILE_COLUMN_KEY, valid(value) ? value : "center");
    return true;
  } catch { return false; }
}
