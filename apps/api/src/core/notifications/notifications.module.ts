import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

/** E-mailové notifikace (katalog, šablony firmy/platformy, odesílání, plánované). */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
