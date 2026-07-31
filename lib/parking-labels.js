export function getParkingLevelLabel(level) {
  const value = Number(level || 1);
  if (value <= 1) return "Ground Level";
  return `Level ${value - 1}`;
}

export function getParkingLevelShortLabel(level) {
  const value = Number(level || 1);
  if (value <= 1) return "G";
  return `L${value - 1}`;
}
