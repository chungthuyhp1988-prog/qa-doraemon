import { describe, it, expect } from 'vitest';
import { getClassPriority, sortClasses } from './classUtils';

describe('classUtils', () => {
  describe('getClassPriority', () => {
    it('should assign priority 1 to Dorami classes', () => {
      expect(getClassPriority('Dorami 1')).toBe(1);
      expect(getClassPriority('dorami-2')).toBe(1);
    });

    it('should assign priority 2 to Shizuka classes', () => {
      expect(getClassPriority('Shizuka')).toBe(2);
      expect(getClassPriority('shizuka class')).toBe(2);
    });

    it('should assign priority 3 to Nobita classes', () => {
      expect(getClassPriority('Nobita')).toBe(3);
      expect(getClassPriority('nobita 3')).toBe(3);
    });

    it('should assign priority 4 to Doraemon classes', () => {
      expect(getClassPriority('Doraemon')).toBe(4);
      expect(getClassPriority('doraemon 10')).toBe(4);
    });

    it('should assign priority 5 to other classes', () => {
      expect(getClassPriority('Suneo')).toBe(5);
      expect(getClassPriority('Gian')).toBe(5);
      expect(getClassPriority('')).toBe(5);
    });
  });

  describe('sortClasses', () => {
    it('should sort classes by priority then alphabetically', () => {
      const input = [
        { name: 'Doraemon 2' },
        { name: 'Dorami 2' },
        { name: 'Shizuka 1' },
        { name: 'Nobita 1' },
        { name: 'Dorami 1' },
        { name: 'Suneo Class' },
      ];

      const expected = [
        { name: 'Dorami 1' },
        { name: 'Dorami 2' },
        { name: 'Shizuka 1' },
        { name: 'Nobita 1' },
        { name: 'Doraemon 2' },
        { name: 'Suneo Class' },
      ];

      expect(sortClasses(input)).toEqual(expected);
    });

    it('should sort alphabetically when priority is the same', () => {
      const input = [
        { name: 'Dorami 3' },
        { name: 'Dorami 1' },
        { name: 'Dorami 2' },
      ];

      const expected = [
        { name: 'Dorami 1' },
        { name: 'Dorami 2' },
        { name: 'Dorami 3' },
      ];

      expect(sortClasses(input)).toEqual(expected);
    });
  });
});
