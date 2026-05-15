import { LegalDocPage } from '../../../components/LegalDocPage';
import { legalDocs } from '../../../lib/master-data';

export default function CompliancePage() {
  const doc = legalDocs.compliance!;
  const related = Object.values(legalDocs).filter((d) => d.slug !== doc.slug);
  return <LegalDocPage doc={doc} related={related} />;
}
