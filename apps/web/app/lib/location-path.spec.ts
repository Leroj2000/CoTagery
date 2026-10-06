import { locationPath, locationDescendants } from './location-path';

const places = [
  { id: 'a', name: 'Praha', parentId: null },
  { id: 'b', name: 'Sklad', parentId: 'a' },
  { id: 'c', name: 'Box 07', parentId: 'b' },
  { id: 'd', name: 'Box 07', parentId: null },
];
it('distinguishes identical box names by their full path', () => {
  expect(locationPath('c', places)).toBe('Praha → Sklad → Box 07');
  expect(locationPath('d', places)).toBe('Box 07');
  expect([...locationDescendants('b', places)]).toEqual(['b', 'c']);
});
it('handles invisible ancestors and legacy cycles without hanging', () => {
  expect(locationPath('c', places.slice(2))).toBe('Box 07');
  const cyclic = [
    { id: 'a', name: 'A', parentId: 'b' },
    { id: 'b', name: 'B', parentId: 'a' },
  ];
  expect(locationPath('a', cyclic)).toBe('B → A');
  expect(locationDescendants('a', cyclic).size).toBe(2);
});
