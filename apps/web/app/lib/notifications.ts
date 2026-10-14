/** Notifikace – typy odpovědí API (Nastavení → Notifikace, Platforma). */
import type { NotificationDef } from '@tagery/shared';

export interface NotificationSettingView extends NotificationDef {
  enabled: boolean;
  subject: string;
  body: string;
  customized: boolean;
  editable: boolean;
}

export interface NotificationLogEntry {
  id: string;
  key: string;
  recipient: string;
  status: 'sent' | 'skipped' | 'failed' | 'test';
  error: string | null;
  createdAt: string;
}

export interface NotificationsOverview {
  isOwner: boolean;
  managerAccess: boolean;
  items: NotificationSettingView[];
  log: NotificationLogEntry[];
}

export interface EmailPreview {
  subject: string;
  text: string;
  html: string;
  errors: string[];
}
