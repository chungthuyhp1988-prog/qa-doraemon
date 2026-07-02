/**
 * Helper to get group name priority (Dorami = 1, Shizuka = 2, Nobita = 3, Doraemon = 4, Khác = 5)
 */
export const getClassPriority = (className: string): number => {
  const nameLower = (className || '').toLowerCase();
  if (nameLower.includes('dorami')) return 1;
  if (nameLower.includes('shizuka')) return 2;
  if (nameLower.includes('nobita')) return 3;
  if (nameLower.includes('doraemon')) return 4;
  return 5;
};

/**
 * Sort classes list by group priority first, then alphabetically by name.
 */
export const sortClasses = <T extends { name: string }>(classes: T[]): T[] => {
  return [...classes].sort((a, b) => {
    const priA = getClassPriority(a.name);
    const priB = getClassPriority(b.name);
    if (priA !== priB) return priA - priB;
    return a.name.localeCompare(b.name, 'vi', { numeric: true });
  });
};
