import { getCompanionForm, setCompanionForm } from "./portraits.js";

export function classifyDescForm(portraitFormKey) {
  return portraitFormKey === "beast" ? "beast" : "human";
}

export function getCompanionDescForm(key) {
  return classifyDescForm(getCompanionForm(key));
}

export function setCompanionDescForm(key, form) {
  setCompanionForm(key, form === "human" ? "form1" : "beast");
}
