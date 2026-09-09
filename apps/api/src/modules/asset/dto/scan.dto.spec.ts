import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ScanDto } from './scan.dto';

describe('scan capture validation', () => {
  const position = {
    latitude: 50,
    longitude: 14,
    accuracyMeters: 12,
    capturedAt: '2026-09-06T12:00:00Z',
    source: 'device',
  };
  it('accepts a manual map point without claiming GPS accuracy', async () => {
    expect(
      await validate(
        plainToInstance(ScanDto, {
          code: 'test',
          position: {
            latitude: 50,
            longitude: 14,
            source: 'manual',
            capturedAt: position.capturedAt,
          },
        }),
      ),
    ).toHaveLength(0);
  });
  it('requires accuracy for a device position', async () => {
    expect(
      (
        await validate(
          plainToInstance(ScanDto, {
            code: 'test',
            position: {
              latitude: 50,
              longitude: 14,
              source: 'device',
              capturedAt: position.capturedAt,
            },
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('validates manual location UUID', async () => {
    expect(
      await validate(
        plainToInstance(ScanDto, {
          code: 'test',
          manualLocationId: 'c2a6d28c-7113-42d9-901e-b9c675a102ed',
        }),
      ),
    ).toHaveLength(0);
    expect(
      (await validate(plainToInstance(ScanDto, { code: 'test', manualLocationId: 'bad' }))).length,
    ).toBeGreaterThan(0);
  });
  it.each(['qr', 'barcode', 'nfc', 'rfid', 'manual', 'unknown'])(
    'accepts %s with or without position',
    async (technology) => {
      expect(
        await validate(plainToInstance(ScanDto, { code: 'test', technology, position })),
      ).toHaveLength(0);
      expect(await validate(plainToInstance(ScanDto, { code: 'test', technology }))).toHaveLength(
        0,
      );
    },
  );
  it.each([
    { latitude: 91 },
    { longitude: -181 },
    { accuracyMeters: -1 },
    { capturedAt: 'bad' },
    { source: 'trusted' },
    { latitude: '50' },
  ])('rejects invalid position %j', async (override) => {
    expect(
      (
        await validate(
          plainToInstance(ScanDto, { code: 'test', position: { ...position, ...override } }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it.each([[], [{}], 'coordinates', 42])('rejects a non-object position %j', async (position) => {
    expect(
      (await validate(plainToInstance(ScanDto, { code: 'test', position }))).length,
    ).toBeGreaterThan(0);
  });
});
