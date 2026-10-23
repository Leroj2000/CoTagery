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

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Data pro webhook transport (n8n) – zachovává dřívější tvar `{type, …}`. */
  webhookPayload?: Record<string, unknown>;
  /** Přílohy (např. iCalendar .ics); přes SMTP i webhook (text v `content`). */
  attachments?: MailAttachment[];
}

export interface MailAttachment {
  filename: string;
  /** Textový obsah přílohy (UTF-8). */
  content: string;
  /** Např. `text/calendar; charset=utf-8; method=PUBLISH`. */
  contentType: string;
}

export interface SendResult {
  status: 'sent' | 'logged' | 'failed';
  error?: string;
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

  /**
   * Odešle hotový e-mail. Pořadí: SMTP → webhook (`PASSWORD_RESET_WEBHOOK_URL`,
   * např. n8n, dostane `webhookPayload`) → jen log. Nikdy nevyhazuje – vrací výsledek.
   */
  async sendRaw(mail: OutgoingMail): Promise<SendResult> {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `Tagery <${this.from()}>`,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          ...(mail.attachments?.length
            ? {
                attachments: mail.attachments.map((a) => ({
                  filename: a.filename,
                  content: a.content,
                  contentType: a.contentType,
                })),
              }
            : {}),
        });
        return { status: 'sent' };
      } catch (err) {
        this.logger.error(`SMTP odeslání selhalo: ${String(err)}`);
        if (!this.config.get<string>('PASSWORD_RESET_WEBHOOK_URL'))
          return { status: 'failed', error: String(err) };
      }
    }
    const hook = this.config.get<string>('PASSWORD_RESET_WEBHOOK_URL');
    if (hook && mail.webhookPayload) {
      try {
        const res = await fetch(hook, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...mail.webhookPayload,
            to: mail.to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            ...(mail.attachments?.length ? { attachments: mail.attachments } : {}),
          }),
        });
        return res.ok ? { status: 'sent' } : { status: 'failed', error: `webhook ${res.status}` };
      } catch (err) {
        this.logger.warn(`Odeslání přes webhook selhalo: ${String(err)}`);
        return { status: 'failed', error: String(err) };
      }
    }
    // Bez transportu (vývoj): obsah jen do logu.
    this.logger.log(`E-mail (bez transportu) pro ${mail.to}: ${mail.subject}\n${mail.text}`);
    return { status: 'logged' };
  }
}
