import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PasswordResetMail {
  to: string;
  name: string;
  url: string;
}

/**
 * Odesílání e-mailů (MVP). Bez SMTP závislosti: odkaz zaloguje a – pokud je
 * nastaven `PASSWORD_RESET_WEBHOOK_URL` – POSTne payload do webhooku (např. n8n,
 * které pošle skutečný e-mail). Reset flow je funkční i bez transportu (z logu).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.logger.log(`Reset hesla pro ${mail.to}: ${mail.url}`);
    const hook = this.config.get<string>('PASSWORD_RESET_WEBHOOK_URL');
    if (!hook) return;
    try {
      await fetch(hook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'password_reset', to: mail.to, name: mail.name, url: mail.url }),
      });
    } catch (err) {
      this.logger.warn(`Odeslání reset webhooku selhalo: ${String(err)}`);
    }
  }
}
