function parseHexColorToRgb(color) {
  const hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16) };
  }
  if (hex.length === 6) {
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  }
  return null;
}
function parseRgbColorToRgb(color) {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(',').map(part => parseFloat(part.trim()));
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
}
function parseColorToRgb(color) {
  if (!color || !isStr(color)) return null;
  const normalizedColor = color.trim();
  if (normalizedColor.startsWith('#')) return parseHexColorToRgb(normalizedColor);
  if (normalizedColor.startsWith('rgb')) return parseRgbColorToRgb(normalizedColor);
  return null;
}
function relativeLuminanceW3C(color) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return 1;
  const channels = [rgb.r, rgb.g, rgb.b].map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}
function isDarkColor(color) { return relativeLuminanceW3C(color) < 0.5; }
function getReadableTextColor(backgroundColor) { return isDarkColor(backgroundColor) ? '#ffffff' : '#111827'; }
function getEventDisplayColor(event, options = DEFAULT_OPTIONS) {
  return event?.backgroundColor || event?.color || event?.borderColor || event?.raw?.backgroundColor || event?.raw?.color || options.defaultEventColor || '#3b8edb';
}
