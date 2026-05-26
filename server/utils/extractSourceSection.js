// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
function extractSourceSection(cleanedText, orderIndex) {
  if (!cleanedText) return '';
  const sections = [];
  let current = null;
  for (const line of cleanedText.split('\n')) {
    if (/^#{1,3}\s+/.test(line)) {
      if (current !== null) sections.push(current.join('\n'));
      current = [line];
    } else if (current !== null) {
      current.push(line);
    }
  }
  if (current !== null) sections.push(current.join('\n'));
  if (sections.length > 0) {
    return sections[Math.max(0, Math.min(orderIndex, sections.length - 1))].trim();
  }
  const parts = cleanedText.split(/\n\n---\n\n|\n---\n/).map(s => s.trim());
  if (parts.length > 1) {
    return parts[Math.max(0, Math.min(orderIndex, parts.length - 1))];
  }
  return cleanedText;
}

module.exports = { extractSourceSection };
