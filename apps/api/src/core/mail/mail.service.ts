import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface PasswordResetMail {
  to: string;
  name: string;
  url: string;
}

export interface AccountActionMail extends PasswordResetMail {
  organizationName: string;
}

/**
 * Odesílání e-mailů. Priorita transportu:
 *  1) SMTP (SMTP_HOST + SMTP_USER + SMTP_PASSWORD) – ostrý provoz,
 *  2) webhook (PASSWORD_RESET_WEBHOOK_URL) – např. n8n,
 *  3) jinak jen log odkazu (dev/fallback). Reset flow funguje ve všech případech.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    if (host) {
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 465);
      this.transporter = createTransport({
        host,
        port,
        secure: port === 465, // 465=SSL, 587=STARTTLS
        ...(user && pass ? { auth: { user, pass } } : {}),
      });
      this.logger.log(`SMTP transport aktivní (${host}:${port})`);
    }
  }

  private from(): string {
    return (
      this.config.get<string>('SMTP_FROM') ??
      this.config.get<string>('SMTP_USER') ??
      'no-reply@tagery.tech'
    );
  }

  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    // Odkaz vždy do logu (audit/fallback), i když se pošle e-mailem.
    this.logger.log(`Reset hesla pro ${mail.to}: ${mail.url}`);

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `Tagery <${this.from()}>`,
          to: mail.to,
          subject: 'Reset hesla – Tagery',
          text:
            `Ahoj ${mail.name},\n\n` +
            `pro nastavení nového hesla klikni na odkaz (platí 1 hodinu):\n${mail.url}\n\n` +
            `Pokud jsi o reset nežádal(a), tento e-mail ignoruj.\n\nTagery`,
          html:
            `<p>Ahoj ${mail.name},</p>` +
            `<p>pro nastavení nového hesla klikni na odkaz (platí 1 hodinu):</p>` +
            `<p><a href="${mail.url}">Nastavit nové heslo</a></p>` +
            `<p style="color:#64748b;font-size:12px">Pokud jsi o reset nežádal(a), tento e-mail ignoruj.</p>` +
            `<p>Tagery</p>`,
        });
        return;
      } catch (err) {
        this.logger.error(`SMTP odeslání selhalo: ${String(err)}`);
      }
    }

    const hook = this.config.get<string>('PASSWORD_RESET_WEBHOOK_URL');
    if (hook) {
      try {
        await fetch(hook, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'password_reset',
            to: mail.to,
            name: mail.name,
            url: mail.url,
          }),
        });
      } catch (err) {
        this.logger.warn(`Odeslání reset webhooku selhalo: ${String(err)}`);
      }
    }
  }

  async sendEmailVerification(mail: AccountActionMail): Promise<void> {
    await this.sendAccountAction(
      mail,
      'Ověření e-mailu – Tagery',
      'Ověřit e-mail',
      'ověření e-mailu',
    );
  }

  async sendInvitation(mail: AccountActionMail): Promise<void> {
    await this.sendAccountAction(
      mail,
      `Pozvánka do ${mail.organizationName} – Tagery`,
      'Přijmout pozvánku',
      'přijetí pozvánky',
    );
  }

  private async sendAccountAction(
    mail: AccountActionMail,
    subject: string,
    button: string,
    type: string,
  ): Promise<void> {
    this.logger.log(`${subject} pro ${mail.to}: ${mail.url}`);
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `Tagery <${this.from()}>`,
          to: mail.to,
          subject,
          text: `Ahoj ${mail.name},\n\npro ${type} ve firmě ${mail.organizationName} otevři tento jednorázový odkaz (platí 24 hodin):\n${mail.url}\n\nTagery`,
          html: `<p>Ahoj ${mail.name},</p><p>Pro ${type} ve firmě <strong>${mail.organizationName}</strong> použij tento jednorázový odkaz (platí 24 hodin):</p><p><a href="${mail.url}">${button}</a></p><p>Tagery</p>`,
        });
        return;
      } catch (err) {
        this.logger.error(`SMTP odeslání selhalo: ${String(err)}`);
      }
    }
    const hook = this.config.get<string>('PASSWORD_RESET_WEBHOOK_URL');
    if (hook)
      await fetch(hook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, ...mail }),
      }).catch((err) => this.logger.warn(`Webhook selhal: ${String(err)}`));
  }
}
