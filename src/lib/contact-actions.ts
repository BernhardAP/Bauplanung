import type { Company, Task } from '@/lib/types';

function buildMailto(opts: {
  to?: string | null;
  ccEmails?: string[];
  subject?: string;
  body?: string;
}) {
  const params = new URLSearchParams();
  if (opts.ccEmails && opts.ccEmails.length) params.set('cc', opts.ccEmails.join(','));
  if (opts.subject) params.set('subject', opts.subject);
  if (opts.body) params.set('body', opts.body);
  const qs = params.toString();
  return `mailto:${opts.to ?? ''}${qs ? `?${qs}` : ''}`;
}

export function makeMailHref(task: Task | null, company: Company | null, defaultCc: Company[]) {
  if (!company?.email) return null;
  const cc = defaultCc.filter((c) => c.id !== company.id && c.email).map((c) => c.email!) ;
  return buildMailto({
    to: company.email,
    ccEmails: cc,
    subject: task?.title ?? 'Bauplanung',
    body: task?.notes ?? '',
  });
}

export function makeTelHref(company: Company | null) {
  if (!company?.telefon) return null;
  return `tel:${company.telefon.replace(/\s+/g, '')}`;
}
