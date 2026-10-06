import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength, IsIn, IsISO8601 } from 'class-validator';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { OperationReceiptsService } from '../../core/tenancy/operation-receipts.service';
import { DataCarriersService } from '../../core/domain/carriers/data-carriers.service';
import { Person } from '../../core/domain/entities/person.entity';
import { AssetService } from './asset.service';
import { AuditService } from '../../core/rbac/audit.service';

class RequestDto { @IsUUID() requestId!: string; }
export class PrepareHandoffDto extends RequestDto {
  @IsUUID() assetId!: string;
  @IsUUID() recipientId!: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
export class ConfirmHandoffDto extends RequestDto { @IsString() @MaxLength(2048) code!: string; }
export class SelfLoanDto extends ConfirmHandoffDto { @IsOptional() @IsISO8601() dueAt?: string; }
export class DecideLoanDto extends RequestDto { @IsIn(['approved','rejected']) decision!: 'approved' | 'rejected'; }

@Controller('personal-workflows')
@UseGuards(JwtAuthGuard,PermissionsGuard)
export class PersonalWorkflowsController {
  constructor(private readonly context: TenantContextService,private readonly assets: AssetService,
    private readonly receipts: OperationReceiptsService,private readonly carriers: DataCarriersService,private readonly audit: AuditService) {}
  private async person(userId: string): Promise<Person> {
    const rows = await this.context.manager.query(`SELECT p.id FROM people p JOIN users u ON u.id=$1 WHERE p.user_id=$1 OR (p.user_id IS NULL AND lower(p.email)=lower(u.email))`,[userId]);
    if (rows.length !== 1) throw new ForbiddenException('Účet není jednoznačně spojený s osobou. Požádej správce o kontrolu e-mailu u osoby.');
    const person = await this.context.manager.getRepository(Person).findOneBy({ id:rows[0].id });
    if (!person) throw new NotFoundException('Osoba není dostupná.');
    return person;
  }
  private async lockAsset(id: string) {
    await this.context.manager.query('SELECT id FROM assets WHERE id=$1 FOR UPDATE',[id]);
    return this.assets.get(id);
  }
  @Get('me') @RequirePermission('asset.handoff.use')
  async me(@CurrentUser() user: RequestUser) {
    let person: Person;
    try { person = await this.person(user.userId); } catch (e) { if (e instanceof ForbiddenException) return { linked:false,handoffs:[],loans:[] }; throw e; }
    const handoffs = await this.context.manager.query(`SELECT h.id,h.asset_id AS "assetId",a.name AS "assetName",h.note,h.status,h.created_at AS "createdAt",
      h.to_person_id=$1 AS incoming,p.name AS "recipientName" FROM asset_handoffs h JOIN assets a ON a.id=h.asset_id JOIN people p ON p.id=h.to_person_id
      WHERE h.to_person_id=$1 OR h.from_person_id=$1 ORDER BY h.created_at DESC LIMIT 100`,[person.id]);
    const loans = await this.context.manager.query(`SELECT l.id,l.asset_id AS "assetId",a.name AS "assetName",l.status,l.created_at AS "createdAt"
      FROM asset_self_loans l JOIN assets a ON a.id=l.asset_id WHERE l.person_id=$1 ORDER BY l.created_at DESC LIMIT 100`,[person.id]);
    // Personal records remain tenant-scoped and additionally respect the effective asset scope.
    const visible = async (rows: { assetId:string }[]) => {
      const flags = await Promise.all(rows.map(async (r) => { try { await this.assets.get(r.assetId); return true; } catch (e) { if (e instanceof NotFoundException) return false; throw e; } }));
      return rows.filter((_,i) => flags[i]);
    };
    return { linked:true,handoffs:await visible(handoffs),loans:await visible(loans) };
  }
  @Get('loans') @RequirePermission('asset.reservation.approve')
  async loanApprovals() {
    const rows: { assetId:string }[] = await this.context.manager.query(`SELECT l.id,l.asset_id AS "assetId",a.name AS "assetName",p.name AS "personName",l.status,l.created_at AS "createdAt"
      FROM asset_self_loans l JOIN assets a ON a.id=l.asset_id JOIN people p ON p.id=l.person_id WHERE l.status='pending' ORDER BY l.created_at ASC LIMIT 500`);
    const filtered = [];
    for (const row of rows) { try { await this.assets.get(row.assetId); filtered.push(row); } catch (e) { if (!(e instanceof NotFoundException)) throw e; } }
    return filtered;
  }
  @Post('handoffs') @RequirePermission('asset.handoff.use')
  prepare(@Body() dto:PrepareHandoffDto,@CurrentUser() user:RequestUser) {
    return this.receipts.once('handoff.prepare',user.userId,dto.requestId,[dto.assetId,dto.recipientId,dto.note ?? ''],async () => {
      const person = await this.person(user.userId);
      const asset = await this.lockAsset(dto.assetId);
      if (asset.currentHolderType !== 'person' || asset.currentHolderId !== person.id) throw new ForbiddenException('Předání připravuje současný držitel.');
      if (!this.assets.actionsFor(asset).includes('handover')) throw new BadRequestException('Položku v tomto stavu nelze předat.');
      const recipient = await this.context.manager.getRepository(Person).findOneBy({ id:dto.recipientId });
      if (!recipient || recipient.id === person.id) throw new BadRequestException('Vyber jiného příjemce této firmy.');
      const pending = await this.context.manager.query(`SELECT id FROM asset_handoffs WHERE asset_id=$1 AND status='pending'`,[asset.id]);
      if (pending.length) throw new BadRequestException('Položka už čeká na převzetí. Nejdřív dokonči nebo zruš předchozí předání.');
      const rows = await this.context.manager.query(`INSERT INTO asset_handoffs(tenant_id,asset_id,from_person_id,to_person_id,prepared_by,note) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[this.context.tenantId,asset.id,person.id,recipient.id,user.userId,dto.note ?? null]);
      await this.audit.record({ action:'asset.handoff_prepared',targetType:'asset',targetId:asset.id,after:{ handoffId:rows[0].id,recipientId:recipient.id } });
      return { id:rows[0].id,message:`Předání připraveno pro ${recipient.name}. Do potvrzení zůstává věc u tebe.` };
    });
  }
  @Post('handoffs/:id/confirm') @RequirePermission('asset.handoff.use')
  confirm(@Param('id',ParseUUIDPipe) id:string,@Body() dto:ConfirmHandoffDto,@CurrentUser() user:RequestUser) {
    return this.receipts.once('handoff.confirm',user.userId,dto.requestId,[id,dto.code],async () => {
      const person = await this.person(user.userId);
      const rows = await this.context.manager.query(`SELECT * FROM asset_handoffs WHERE id=$1 FOR UPDATE`,[id]);
      const h = rows[0]; if (!h) throw new NotFoundException('Předání neexistuje.');
      if (h.to_person_id !== person.id) throw new ForbiddenException('Převzetí potvrzuje pouze určený příjemce.');
      const asset = await this.lockAsset(h.asset_id);
      const carrier = await this.carriers.findByCode(dto.code);
      if (!carrier || carrier.digitalObjectId !== asset.digitalObjectId || carrier.status !== 'active') throw new BadRequestException('Načtený identifikátor nepatří této položce nebo není aktivní.');
      if (h.status === 'confirmed') return { message:'Převzetí už je potvrzené.',status:'duplicate' };
      if (h.status !== 'pending') throw new BadRequestException('Předání již není otevřené.');
      if (asset.currentHolderType !== 'person' || asset.currentHolderId !== h.from_person_id) throw new BadRequestException('Držitel se mezitím změnil. Nech připravit nové předání.');
      await this.assets.performMovement(asset.id,{ type:'handover',toType:'person',toId:person.id,actorPersonId:person.id,note:`Převzetí identifikátorem; předání ${id}` });
      await this.context.manager.query(`UPDATE asset_handoffs SET status='confirmed',completed_at=clock_timestamp(),completed_by=$2 WHERE id=$1`,[id,user.userId]);
      await this.audit.record({ action:'asset.handoff_confirmed',targetType:'asset',targetId:asset.id,after:{ handoffId:id,carrierId:carrier.id } });
      return { message:`Převzato: ${asset.name}. Věc je nyní evidovaná u tebe.`,status:'saved' };
    });
  }
  @Post('handoffs/:id/cancel') @RequirePermission('asset.handoff.use')
  cancel(@Param('id',ParseUUIDPipe) id:string,@Body() dto:RequestDto,@CurrentUser() user:RequestUser) {
    return this.receipts.once('handoff.cancel',user.userId,dto.requestId,[id],async () => {
      const rows = await this.context.manager.query(`SELECT * FROM asset_handoffs WHERE id=$1 FOR UPDATE`,[id]);
      const h=rows[0]; if (!h) throw new NotFoundException('Předání neexistuje.');
      await this.assets.get(h.asset_id);
      if (h.prepared_by !== user.userId) throw new ForbiddenException('Předání může zrušit ten, kdo ho připravil.');
      if (h.status !== 'pending') throw new BadRequestException('Předání už není otevřené.');
      await this.context.manager.query(`UPDATE asset_handoffs SET status='cancelled',completed_at=clock_timestamp(),completed_by=$2 WHERE id=$1`,[id,user.userId]);
      await this.audit.record({ action:'asset.handoff_cancelled',targetType:'asset',targetId:h.asset_id,after:{ handoffId:id } });
      return { message:'Předání zrušeno. Držitel se nezměnil.' };
    });
  }
  @Post('loans') @RequirePermission('asset.selfloan.use')
  loan(@Body() dto:SelfLoanDto,@CurrentUser() user:RequestUser) {
    return this.receipts.once('selfloan.take',user.userId,dto.requestId,[dto.code,dto.dueAt ?? null],async () => {
      const person=await this.person(user.userId);
      const carrier=await this.carriers.findByCode(dto.code);
      if (!carrier?.digitalObjectId || carrier.status !== 'active') throw new BadRequestException('Načti aktivní identifikátor položky.');
      const asset=await this.assets.getByObject(carrier.digitalObjectId);
      if (!asset) throw new NotFoundException('Položka není dostupná.');
      await this.lockAsset(asset.id);
      await this.assets.performMovement(asset.id,{ type:'loan',toType:'person',toId:person.id,actorPersonId:person.id,dueAt:dto.dueAt,note:'Samoobslužně převzato; půjčení čeká na schválení.' });
      const movementId=await this.assets.lastMovementId(asset.id);
      const rows=await this.context.manager.query(`INSERT INTO asset_self_loans(tenant_id,asset_id,person_id,requested_by,movement_id) VALUES($1,$2,$3,$4,$5) RETURNING id`,[this.context.tenantId,asset.id,person.id,user.userId,movementId]);
      await this.audit.record({ action:'asset.selfloan_taken',targetType:'asset',targetId:asset.id,after:{ loanId:rows[0].id,status:'pending' } });
      return { id:rows[0].id,message:'Vybavení je evidované u tebe a můžeš ho odnést. Schválení půjčení zatím čeká.',status:'pending' };
    });
  }
  @Post('loans/:id/decide') @RequirePermission('asset.reservation.approve')
  decide(@Param('id',ParseUUIDPipe) id:string,@Body() dto:DecideLoanDto,@CurrentUser() user:RequestUser) {
    return this.receipts.once('selfloan.decide',user.userId,dto.requestId,[id,dto.decision],async () => {
      const rows=await this.context.manager.query(`SELECT * FROM asset_self_loans WHERE id=$1 FOR UPDATE`,[id]);
      const loan=rows[0]; if(!loan) throw new NotFoundException('Žádost neexistuje.');
      await this.assets.get(loan.asset_id);
      if(loan.status !== 'pending') throw new BadRequestException('Žádost už byla rozhodnutá.');
      await this.context.manager.query(`UPDATE asset_self_loans SET status=$2,decided_by=$3,decided_at=clock_timestamp() WHERE id=$1`,[id,dto.decision,user.userId]);
      await this.audit.record({ action:`asset.selfloan_${dto.decision}`,targetType:'asset',targetId:loan.asset_id,after:{ loanId:id } });
      return { message:dto.decision === 'approved' ? 'Půjčení schváleno. Držitel zůstává stejný.' : 'Půjčení zamítnuto. Věc zůstává u držitele, dokud není fyzicky vrácena a vrácení zapsáno.' };
    });
  }
}
