export type TaskStatus = string;
export type BuiltInStatus = 'open' | 'in_progress' | 'waiting' | 'done' | 'blocked' | 'question';
export type AttachmentKind = 'document' | 'email' | 'link';

export interface Company {
  id: string;
  name: string;
  kuerzel: string;
  kontaktperson: string | null;
  telefon: string | null;
  email: string | null;
  adresse: string | null;
  web: string | null;
  notes: string | null;
  is_default_cc: boolean;
  color: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  parent_id: string | null;
  depth: number;
  sort_order: number;
  status: TaskStatus;
  company_id: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  filename: string;
  storage_path: string | null;
  url: string | null;
  mime_type: string | null;
  kind: AttachmentKind;
  created_at: string;
}

export const STATUS_ORDER: BuiltInStatus[] = ['open', 'in_progress', 'waiting', 'question', 'blocked', 'done'];

export const STATUS_LABEL: Record<BuiltInStatus, string> = {
  open: 'Offen',
  in_progress: 'In Arbeit',
  waiting: 'Wartet',
  question: 'Frage',
  blocked: 'Blockiert',
  done: 'Erledigt',
};
