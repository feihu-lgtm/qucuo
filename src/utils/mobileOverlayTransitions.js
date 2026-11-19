export function didOpenOverlay(previousOverlays, currentOverlays) {
  const previous = new Set(previousOverlays);
  return currentOverlays.some(overlay => !previous.has(overlay));
}

export function didOpenConfirmation(previousConfirmation, currentConfirmation) {
  return Boolean(currentConfirmation && currentConfirmation !== previousConfirmation);
}
