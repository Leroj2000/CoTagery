import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Sdílené odesílání e-mailů (reset hesla apod.). */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
