import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { decodeReport } from '../lib/share';
import { useT } from '../i18n';
import { EmptyState } from '../components/ui';
import { ReportView } from '../components/ReportView';
import { LanguageMenu } from '../components/layout/LanguageMenu';
import { IS_EMBEDDED } from '../env';

/** The public, read-only page a shared report link opens. No sign-in needed. */
export default function SharedReport() {
  const t = useT();
  const { data = '' } = useParams();
  const report = useMemo(() => decodeReport(data), [data]);
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:py-10 dark:bg-ink-950">
      <div className="mx-auto max-w-4xl">
        <div className="no-print mb-4 flex items-center justify-end gap-2">
          <LanguageMenu />
          {report && !IS_EMBEDDED && (
            <button className="btn-secondary btn-sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> {t('Print or save as PDF')}
            </button>
          )}
        </div>
        <div className="print-area card p-6 sm:p-10">
          {report ? (
            <ReportView report={report} />
          ) : (
            <EmptyState
              icon={<Printer className="h-6 w-6" />}
              title={t('This report link is incomplete')}
              body={t('Ask the person who shared it to copy the whole link again.')}
              action={
                <Link to="/" className="btn-secondary btn-sm">
                  {t('Go to Tokuma')}
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
