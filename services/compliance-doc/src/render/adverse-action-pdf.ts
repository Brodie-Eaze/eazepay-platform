import PDFDocument from 'pdfkit';
import type { AdverseActionNoticeContent } from '../notices/adverse-action.types.js';

const FCRA_FREE_DISCLOSURE_BLOCK =
  'You have the right to obtain, within 60 days, a free copy of your consumer report from the consumer reporting agency identified above. The consumer reporting agency did not make the credit decision and cannot provide you with the specific reasons for the decision. You also have the right to dispute the accuracy or completeness of any information in your consumer report furnished by the consumer reporting agency.';

const ECOA_NONDISCRIM_BLOCK =
  'The Federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, age (provided the applicant has the capacity to enter into a binding contract); because all or part of the applicant\'s income derives from any public assistance program; or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act. The federal agency that administers compliance with this law concerning this creditor is the Consumer Financial Protection Bureau, 1700 G Street NW, Washington, DC 20552.';

const COMPLAINT_BLOCK =
  'If you have a complaint about this decision or this notice, you can submit a complaint to the Consumer Financial Protection Bureau at consumerfinance.gov/complaint or by calling (855) 411-2372. You may also contact your state attorney general.';

/**
 * Render the notice as a single-page PDF (US Letter, portrait). Output
 * is a Buffer; the caller persists it to ObjectStorage and writes a
 * Document row.
 *
 * Layout is intentionally plain — the goal is a notice that survives
 * legal scrutiny, not a marketing piece. No imagery, no tables; clear
 * blocks with the regulatory language verbatim.
 */
export async function renderAdverseActionPdf(
  content: AdverseActionNoticeContent,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 54, bottom: 54, left: 54, right: 54 },
    info: {
      Title: 'Adverse Action Notice',
      Subject: `EazePay Application ${content.application.id}`,
      Author: content.lenderOfRecord.legalName,
      CreationDate: new Date(content.generatedAt),
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c as Buffer));
  const finished = new Promise<void>((resolve) => doc.on('end', () => resolve()));

  // Header — lender of record (the partner bank or licensed entity).
  doc.font('Helvetica-Bold').fontSize(11).text(content.lenderOfRecord.legalName);
  doc.font('Helvetica').fontSize(9);
  doc.text(content.lenderOfRecord.addressLine1);
  if (content.lenderOfRecord.addressLine2) doc.text(content.lenderOfRecord.addressLine2);
  doc.text(`${content.lenderOfRecord.city}, ${content.lenderOfRecord.state} ${content.lenderOfRecord.zip}`);
  if (content.lenderOfRecord.servicerLine) doc.text(content.lenderOfRecord.servicerLine);

  doc.moveDown(1);
  doc.fontSize(10).text(`Date: ${content.application.decisionDate}`);

  // Recipient block.
  doc.moveDown(0.5);
  doc.text(content.recipient.legalName);
  if (content.recipient.address) {
    const a = content.recipient.address;
    doc.text(a.line1);
    if (a.line2) doc.text(a.line2);
    doc.text(`${a.city}, ${a.state} ${a.zip}`);
  } else if (content.recipient.email) {
    doc.text(content.recipient.email);
  }

  // Title.
  doc.moveDown(1.2);
  doc.font('Helvetica-Bold').fontSize(14).text('Notice of Action Taken on Your Credit Application', {
    align: 'left',
  });

  // Decision summary.
  doc.moveDown(0.6);
  doc.font('Helvetica').fontSize(10).text(
    `We have considered your recent application for ${content.application.categoryDisplay} financing in the amount of ${content.application.amountDisplay} for a term of ${content.application.termDisplay}. We are unable to approve your application at this time. The principal reasons for this action are:`,
  );

  // Reasons list.
  doc.moveDown(0.5);
  for (const r of content.reasons) {
    doc.font('Helvetica').fontSize(10).text(`• ${r}`, { indent: 12 });
  }

  // FCRA bureau block when applicable.
  if (content.bureau) {
    const b = content.bureau;
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(11).text('Information from a Consumer Reporting Agency');
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(
        `Our credit decision was based in whole or in part on information obtained in a report from the consumer reporting agency listed below.`,
      );
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text(b.name);
    doc.font('Helvetica').text(b.addressLine1);
    doc.text(`${b.city}, ${b.state} ${b.zip}`);
    doc.text(`Phone: ${b.phone}`);

    if (b.score !== undefined && b.scoreRangeDisplay) {
      doc.moveDown(0.4);
      doc
        .font('Helvetica-Bold')
        .text('Credit Score Disclosure');
      doc
        .font('Helvetica')
        .text(`Your credit score: ${b.score} (range: ${b.scoreRangeDisplay})`);
      if (b.keyFactors?.length) {
        doc.text('Key factors that adversely affected your score:');
        for (const f of b.keyFactors) doc.text(`• ${f}`, { indent: 12 });
      }
    }

    doc.moveDown(0.4);
    doc.font('Helvetica').text(FCRA_FREE_DISCLOSURE_BLOCK, { lineGap: 1.2 });
  }

  // ECOA non-discrimination block (always).
  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(11).text('Equal Credit Opportunity Act Notice');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).text(ECOA_NONDISCRIM_BLOCK, { lineGap: 1.2 });

  // Complaint block.
  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(11).text('How to Submit a Complaint');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).text(COMPLAINT_BLOCK, { lineGap: 1.2 });

  // Footer — internal references (audit anchor for the printed copy).
  doc.moveDown(1.2);
  doc.fontSize(8).fillColor('#555555').text(
    `Reference: Application ${content.application.id} • Policy version ${content.policyVersion} • Generated ${content.generatedAt}`,
  );

  doc.end();
  await finished;
  return Buffer.concat(chunks);
}
