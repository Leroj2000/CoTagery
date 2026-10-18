import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { formatTireSize } from '@tagery/shared';
import { CreateTireDto, MountTireSetDto, UpdateTireDto } from './dto/tire.dto';
import type { AssetTire } from './entities/asset-tire.entity';
import { TiresService, planMount } from './tires.service';
import type { TenantContextService } from '../../core/tenancy/tenant-context.service';

const valid = {
  setLabel: 'Letní',
  season: 'summer',
  axle: 'all',
  width: 205,
  aspectRatio: 55,
  rimDiameter: 16,
  loadIndex: '91',
  speedIndex: 'V',
  dot: '2423',
  treadDepthMm: 6.5,
  quantity: 4,
};

const errorsOf = async (cls: new () => object, body: object) =>
  (await validate(plainToInstance(cls, body))).map((e) => e.property);

describe('CreateTireDto', () => {
  it('přijme běžnou osobní pneumatiku 205/55 R16 91V', async () => {
    expect(await errorsOf(CreateTireDto, valid)).toEqual([]);
  });

  it('přijme stavební pneu bez profilu s ráfkem 24 a dvojitým indexem', async () => {
    expect(
      await errorsOf(CreateTireDto, {
        setLabel: 'Stavební',
        season: 'construction',
        width: 405,
        aspectRatio: null,
        rimDiameter: 22.5,
        loadIndex: '160/158',
        construction: 'D',
      }),
    ).toEqual([]);
  });

  it('odmítne neplatné hodnoty', async () => {
    const errs = await errorsOf(CreateTireDto, {
      ...valid,
      season: 'spring',
      axle: 'middle',
      width: 0,
      rimDiameter: 16.25,
      speedIndex: 'VV',
      dot: '24/23',
      construction: 'X',
    });
    expect(errs.sort()).toEqual(
      ['axle', 'construction', 'dot', 'rimDiameter', 'season', 'speedIndex', 'width'].sort(),
    );
  });

  it('vyžaduje název sady, sezónu, šířku a ráfek', async () => {
    expect((await errorsOf(CreateTireDto, {})).sort()).toEqual(
      ['rimDiameter', 'season', 'setLabel', 'width'].sort(),
    );
  });

  it('úprava i přezutí validují', async () => {
    expect(await errorsOf(UpdateTireDto, { treadDepthMm: 4 })).toEqual([]);
    expect(await errorsOf(UpdateTireDto, { season: 'x' })).toEqual(['season']);
    expect(await errorsOf(MountTireSetDto, { setLabel: '' })).toEqual(['setLabel']);
  });
});

const row = (id: string, setLabel: string, mounted: boolean, axle = 'all'): AssetTire =>
  ({ id, assetId: 'a', setLabel, mounted, axle }) as AssetTire;

describe('planMount', () => {
  it('namontuje celou sadu a sundá ostatní', () => {
    const rows = [
      row('1', 'Letní', true, 'front'),
      row('2', 'Letní', true, 'rear'),
      row('3', 'Zimní', false, 'front'),
      row('4', 'Zimní', false, 'rear'),
    ];
    const changed = planMount(rows, 'Zimní');
    expect(changed.map((r) => r.id).sort()).toEqual(['1', '2', '3', '4']);
    expect(rows.filter((r) => r.mounted).map((r) => r.id)).toEqual(['3', '4']);
  });

  it('už namontovaná sada nic nemění', () => {
    expect(planMount([row('1', 'Letní', true), row('2', 'Zimní', false)], 'Letní')).toEqual([]);
  });

  it('neznámá sada → 404', () => {
    expect(() => planMount([row('1', 'Letní', true)], 'Zimní')).toThrow(NotFoundException);
  });
});

describe('TiresService.mount', () => {
  it('uloží jen změněné řádky a vrátí seznam s namontovanou sadou první', async () => {
    const rows = [row('1', 'Letní', true), row('2', 'Zimní', false)];
    const save = jest.fn(async (x) => x);
    const context = {
      tenantId: 't',
      manager: {
        getRepository: (e: { name: string }) =>
          e.name === 'Asset'
            ? { findOne: jest.fn().mockResolvedValue({ id: 'a' }) }
            : { find: jest.fn().mockResolvedValue(rows), save },
      },
    } as unknown as TenantContextService;
    const list = await new TiresService(context).mount('a', 'Zimní');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toHaveLength(2);
    expect(list.map((r) => `${r.setLabel}:${r.mounted}`)).toEqual(['Zimní:true', 'Letní:false']);
  });
});

describe('formatTireSize', () => {
  it('formáty rozměru', () => {
    expect(
      formatTireSize({
        width: 205,
        aspectRatio: 55,
        rimDiameter: 16,
        construction: 'R',
        loadIndex: '91',
        speedIndex: 'V',
      }),
    ).toBe('205/55 R16 91V');
    expect(
      formatTireSize({
        width: 405,
        aspectRatio: null,
        rimDiameter: 22.5,
        construction: 'D',
        loadIndex: null,
        speedIndex: null,
      }),
    ).toBe('405 D22.5');
  });
});
