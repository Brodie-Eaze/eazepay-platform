import type { Metadata } from 'next';
import { LegalPage } from '../_components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How EazePay Inc. collects, uses, shares, secures and retains personal and financial information, and the privacy rights available to you.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Privacy Policy"
      updated="June 2, 2026"
      intro={
        <>
          This Privacy Policy describes how <strong>EazePay Inc.</strong> (&ldquo;EazePay,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, discloses,
          secures, and retains information about you when you visit our websites, contact us, or use
          our payment-orchestration, prequalification, lending-marketplace, and related services
          (collectively, the &ldquo;Services&rdquo;). It also explains the choices and rights you
          have regarding your information. By using the Services, you acknowledge the practices
          described here.
        </>
      }
    >
      <h2>1. Who we are and scope of this policy</h2>
      <p>
        EazePay Inc. is a financial-technology company that provides infrastructure — including
        prequalification software, automated decisioning agents, a lender marketplace, and payment
        processing — that powers consumer- and merchant-facing brands such as MedPay, TradePay,
        CoachPay, and VetPay. This policy applies to information we process as a business (a
        &ldquo;controller&rdquo;). Where we process information on behalf of a business customer
        (for example, a merchant or partner) under their instructions, we act as a service provider
        or processor, and that customer&apos;s privacy notice governs that processing.
      </p>
      <p>
        This policy does not apply to third-party websites, products, or services that we do not own
        or control, including the lenders, processors, and partners to whom an application may be
        routed. Their handling of your information is governed by their own privacy notices.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li>
          <span>
            <strong>Identity and contact data</strong> — name, email address, postal address, phone
            number, business name, and job title (for example, when you request a call or create an
            account).
          </span>
        </li>
        <li>
          <span>
            <strong>Application and financial data</strong> — information submitted through a
            prequalification or financing form, which may include date of birth, the last four
            digits of a government identifier, income, employment, requested amount, and similar
            details needed to evaluate an application.
          </span>
        </li>
        <li>
          <span>
            <strong>Payment data</strong> — card or bank-account information used to process a
            transaction. Card data is tokenized and handled within a scope-minimized environment; we
            do not store full card numbers on our general systems.
          </span>
        </li>
        <li>
          <span>
            <strong>Communications</strong> — the contents of messages, support requests, and call
            notes you share with us.
          </span>
        </li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>
          <span>
            <strong>Device and usage data</strong> — IP address, browser type, operating system,
            referring pages, pages viewed, and timestamps, collected through cookies and similar
            technologies.
          </span>
        </li>
        <li>
          <span>
            <strong>Cookies and analytics</strong> — we use strictly necessary cookies to operate
            the site and, where permitted, analytics cookies to understand usage. You can control
            non-essential cookies through your browser or our cookie controls where offered.
          </span>
        </li>
      </ul>
      <h3>Information from third parties</h3>
      <ul>
        <li>
          <span>
            <strong>Verification and risk data</strong> — to verify identity, prevent fraud, and
            evaluate applications, we may receive information from identity-verification vendors,
            consumer-reporting agencies (via soft inquiries that do not affect a credit score unless
            otherwise disclosed), sanctions and watchlist providers, and our business customers.
          </span>
        </li>
      </ul>

      <h2>3. How we use information</h2>
      <ul>
        <li>
          <span>To provide, operate, maintain, and improve the Services;</span>
        </li>
        <li>
          <span>
            To evaluate prequalification and financing requests and route them to appropriate
            lenders or partners;
          </span>
        </li>
        <li>
          <span>To process payments, settlement, refunds, and reconciliation;</span>
        </li>
        <li>
          <span>
            To verify identity and to detect, investigate, and prevent fraud, money laundering, and
            other unlawful or prohibited activity;
          </span>
        </li>
        <li>
          <span>
            To communicate with you, respond to inquiries, and send administrative or transactional
            messages;
          </span>
        </li>
        <li>
          <span>
            To comply with legal and regulatory obligations and to enforce our agreements; and
          </span>
        </li>
        <li>
          <span>
            With your consent or as otherwise permitted by law, for marketing about products and
            features that may interest you.
          </span>
        </li>
      </ul>

      <h2>4. Legal bases for processing</h2>
      <p>
        Where applicable law requires a legal basis (for example, in the EEA/UK), we rely on one or
        more of the following: performance of a contract; compliance with a legal obligation; our
        legitimate interests in operating and securing the Services; and your consent, which you may
        withdraw at any time.
      </p>

      <h2>5. How we share information</h2>
      <p>We do not sell your personal information for money. We may share information with:</p>
      <ul>
        <li>
          <span>
            <strong>Lenders and financing partners</strong> to evaluate and fulfill an application
            you submit;
          </span>
        </li>
        <li>
          <span>
            <strong>Payment processors and financial institutions</strong> to process and settle
            transactions;
          </span>
        </li>
        <li>
          <span>
            <strong>Service providers and sub-processors</strong> (such as cloud hosting, analytics,
            identity verification, and communications) who process information on our behalf under
            written agreements;
          </span>
        </li>
        <li>
          <span>
            <strong>Our business customers</strong> whose branded experience you used;
          </span>
        </li>
        <li>
          <span>
            <strong>Authorities and others</strong> when required by law, subpoena, or legal
            process, or to protect rights, safety, and the integrity of the Services; and
          </span>
        </li>
        <li>
          <span>
            <strong>Acquirers</strong> in connection with a merger, financing, acquisition, or sale
            of assets, subject to this policy.
          </span>
        </li>
      </ul>

      <h2>6. Financial privacy (GLBA)</h2>
      <p>
        Certain information we handle is &ldquo;nonpublic personal information&rdquo; subject to the
        Gramm-Leach-Bliley Act. We restrict the use and disclosure of such information to what is
        permitted under applicable law, maintain administrative, technical, and physical safeguards
        designed to protect it, and provide privacy notices where required.
      </p>

      <h2>7. Cookies and tracking</h2>
      <p>
        We use cookies and similar technologies to operate the site, remember preferences, measure
        performance, and, where permitted, support analytics. You can refuse non-essential cookies
        through your browser settings or any cookie controls we provide. Some features may not
        function without certain cookies.
      </p>

      <h2>8. Data security</h2>
      <p>
        We maintain a security program with administrative, technical, and physical safeguards
        designed to protect information, including encryption in transit and at rest, tokenization
        of sensitive payment data, access controls, logging, and monitoring. No method of
        transmission or storage is completely secure, and we cannot guarantee absolute security.
      </p>

      <h2>9. Data retention</h2>
      <p>
        We retain information for as long as needed to provide the Services and for legitimate
        business purposes, such as complying with legal, tax, accounting, audit, and regulatory
        obligations, resolving disputes, and enforcing agreements. Financial records may be retained
        for the periods required by applicable law. When information is no longer needed, we delete,
        anonymize, or securely store it.
      </p>

      <h2>10. Your privacy rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, or receive a
        copy of your personal information; to opt out of certain processing (including targeted
        advertising or any &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; as defined by applicable
        law); and to be free from unlawful discrimination for exercising these rights.
      </p>
      <h3>U.S. state privacy rights</h3>
      <p>
        Residents of states with comprehensive privacy laws (including California, Virginia,
        Colorado, Connecticut, Utah, and others) may exercise the rights granted by those laws. To
        the extent the California Consumer Privacy Act applies, we do not sell personal information
        for monetary consideration, and you may submit access, deletion, correction, and opt-out
        requests as described below.
      </p>
      <h3>EEA/UK rights</h3>
      <p>
        If you are in the EEA or UK, you may have rights to access, rectification, erasure,
        restriction, portability, and objection, and to lodge a complaint with a supervisory
        authority.
      </p>
      <p>
        To exercise any right, contact us at{' '}
        <a href="mailto:support@eazepay.com">support@eazepay.com</a>. We will verify your request as
        required by law and respond within the applicable timeframe. You may use an authorized agent
        where permitted.
      </p>

      <h2>11. International transfers</h2>
      <p>
        We may process and store information in the United States and other countries. Where we
        transfer information across borders, we use safeguards required by applicable law, such as
        standard contractual clauses.
      </p>

      <h2>12. Children&apos;s privacy</h2>
      <p>
        The Services are intended for adults and are not directed to children under 18. We do not
        knowingly collect personal information from children. If you believe a child has provided us
        information, contact us and we will take appropriate steps to delete it.
      </p>

      <h2>13. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the updated version with a
        new &ldquo;Last updated&rdquo; date and, where required, provide additional notice. Your
        continued use of the Services after changes take effect constitutes acceptance.
      </p>

      <h2>14. Contact us</h2>
      <p>
        EazePay Inc. — Privacy Team
        <br />
        Email: <a href="mailto:support@eazepay.com">support@eazepay.com</a>
        <br />
        General: <a href="mailto:support@eazepay.com">support@eazepay.com</a>
      </p>
    </LegalPage>
  );
}
