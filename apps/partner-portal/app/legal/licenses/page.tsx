import { LegalDocPage } from '../../../components/LegalDocPage';
import { legalDocs } from '../../../lib/master-data';

export default function LicensesPage() {
  const doc = legalDocs.licenses!;
  const related = Object.values(legalDocs).filter((d) => d.slug !== doc.slug);
  return <LegalDocPage doc={doc} related={related} />;
}
