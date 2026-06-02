import type { Metadata } from 'next';
import { LegalPage } from '../_components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How EazePay Inc. collects, uses, shares, secures and retains personal and financial information, and the privacy rights available to you under U.S. state laws, GLBA, and the GDPR/UK GDPR.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Privacy Policy"
      updated="June 2, 2026"
      intro={
        <>
          This Privacy Policy explains how <strong>EazePay Inc.</strong> (&ldquo;EazePay,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, discloses,
          secures, retains, and protects information about you when you visit our websites, contact
          us, apply for or use financing, make or accept payments, or otherwise use our
          payment-orchestration, prequalification, lending-marketplace, and related products and
          services (collectively, the &ldquo;Services&rdquo;). It also describes the choices and
          legal rights you have over your information. Please read it carefully. By using the
          Services, you acknowledge the practices described in this Policy.
        </>
      }
    >
      <h2>1. Who we are; controller and processor roles</h2>
      <p>
        EazePay Inc. is a financial-technology company that provides the infrastructure:
        prequalification software, automated decisioning agents, a lender marketplace, an
        orchestration waterfall, application tracking, and payment processing, that powers consumer-
        and merchant-facing brands such as MedPay, TradePay, CoachPay, and VetPay.
      </p>
      <p>
        For some processing we act as a <strong>business / controller</strong> that determines the
        purposes and means of processing (for example, operating our website and corporate
        relationships). For other processing we act as a{' '}
        <strong>service provider / processor</strong> on behalf of a business customer (such as a
        merchant or partner) under their instructions and contract; in those cases that
        customer&apos;s own privacy notice governs, and we process the information only as needed to
        provide the Services and as permitted by law.
      </p>

      <h2>2. Scope and updates to this Policy</h2>
      <p>
        This Policy applies to information processed through our public websites, hosted application
        pages, APIs, and SDKs. It does not apply to third-party websites, products, or services we
        do not own or control, including the lenders, processors, financial institutions, and
        verification vendors to whom an application or transaction may be routed; their handling of
        your information is governed by their own notices. We may update this Policy from time to
        time as described in Section 21.
      </p>

      <h2>3. Categories of information we collect</h2>
      <p>
        The specific information we collect depends on how you interact with the Services. Over the
        preceding 12 months, we may have collected the following categories:
      </p>
      <h3>(a) Information you provide directly</h3>
      <ul>
        <li>
          <span>
            <strong>Identifiers and contact data</strong>, name, email address, postal address,
            phone number, business name, job title, and account credentials.
          </span>
        </li>
        <li>
          <span>
            <strong>Application and financial information</strong>, information submitted through a
            prequalification or financing form, which may include date of birth, the last four
            digits of a Social Security number or other government identifier, income, employment,
            housing, requested amount, and similar details necessary to evaluate an application.
          </span>
        </li>
        <li>
          <span>
            <strong>Payment information</strong>, card, bank-account, or other payment-instrument
            details used to process a transaction. Card data is tokenized and handled within a
            scope-minimized, PCI-aware environment; we do not store full primary account numbers on
            our general systems.
          </span>
        </li>
        <li>
          <span>
            <strong>Communications and support content</strong>, the contents of messages, support
            tickets, survey responses, and call notes you share with us.
          </span>
        </li>
      </ul>
      <h3>(b) Information collected automatically</h3>
      <ul>
        <li>
          <span>
            <strong>Device and connection data</strong>, IP address, device and browser type,
            operating system, language, and mobile identifiers.
          </span>
        </li>
        <li>
          <span>
            <strong>Usage and analytics data</strong>, pages and screens viewed, referring/exit
            pages, links clicked, session duration, timestamps, and similar interactions, collected
            via cookies, pixels, SDKs, and server logs.
          </span>
        </li>
        <li>
          <span>
            <strong>Approximate location</strong>, derived from IP address for security, fraud
            prevention, and localization. We do not collect precise geolocation without consent.
          </span>
        </li>
      </ul>
      <h3>(c) Information from third parties</h3>
      <ul>
        <li>
          <span>
            <strong>Verification and risk data</strong>, from identity-verification vendors,
            consumer-reporting agencies (via soft inquiries that do not affect a credit score unless
            otherwise disclosed to you), fraud and device-intelligence providers, and sanctions /
            watchlist screening providers.
          </span>
        </li>
        <li>
          <span>
            <strong>Business-customer and partner data</strong>, information our merchants and
            partners provide about applicants and transactions routed through the Services.
          </span>
        </li>
      </ul>

      <h2>4. Sensitive information</h2>
      <p>
        Some information we process may be considered &ldquo;sensitive&rdquo; under applicable law,
        such as financial-account information, government identifiers, and precise data needed to
        evaluate an application. We use sensitive information only for the purposes permitted by law
        and necessary to provide the Services (such as completing a transaction, verifying identity,
        and preventing fraud), and we apply heightened safeguards. We do not use sensitive
        information to infer characteristics about you for advertising.
      </p>

      <h2>5. How we use information</h2>
      <ul>
        <li>
          <span>To provide, operate, maintain, secure, and improve the Services;</span>
        </li>
        <li>
          <span>
            To evaluate prequalification and financing requests and route them in parallel to
            appropriate lenders and partners;
          </span>
        </li>
        <li>
          <span>To process payments, disbursement, settlement, refunds, and reconciliation;</span>
        </li>
        <li>
          <span>
            To verify identity and to detect, investigate, prevent, and respond to fraud, money
            laundering, sanctions risk, and other unlawful or prohibited activity;
          </span>
        </li>
        <li>
          <span>
            To create de-identified, aggregated, or statistical data, which we may use for any
            lawful business purpose;
          </span>
        </li>
        <li>
          <span>
            To communicate with you, respond to inquiries, and send administrative, transactional,
            and (where permitted) marketing messages;
          </span>
        </li>
        <li>
          <span>
            To comply with legal, regulatory, audit, tax, and recordkeeping obligations and to
            establish, exercise, or defend legal claims; and
          </span>
        </li>
        <li>
          <span>
            For any other purpose disclosed to you at the time of collection or with your consent.
          </span>
        </li>
      </ul>

      <h2>6. Legal bases for processing (EEA/UK)</h2>
      <p>
        Where the GDPR or UK GDPR applies, we rely on one or more of these legal bases: (a)
        performance of a contract with you; (b) compliance with a legal obligation; (c) our
        legitimate interests in operating, securing, and improving the Services and preventing
        fraud, balanced against your rights; and (d) your consent, which you may withdraw at any
        time without affecting prior processing.
      </p>

      <h2>7. How and with whom we share information</h2>
      <p>We may disclose information to the following categories of recipients:</p>
      <ul>
        <li>
          <span>
            <strong>Lenders and financing partners</strong>, to evaluate, decision, and fund an
            application you submit;
          </span>
        </li>
        <li>
          <span>
            <strong>Payment processors, networks, and financial institutions</strong>, to authorize,
            process, and settle transactions;
          </span>
        </li>
        <li>
          <span>
            <strong>Service providers and sub-processors</strong>, cloud hosting, data storage,
            analytics, identity verification, fraud prevention, customer support, and communications
            vendors who process information on our behalf under written agreements that restrict
            their use of the information;
          </span>
        </li>
        <li>
          <span>
            <strong>Our business customers</strong>, the merchant or partner whose branded
            experience you used;
          </span>
        </li>
        <li>
          <span>
            <strong>Professional advisors and auditors</strong>, lawyers, accountants, and auditors
            under confidentiality obligations;
          </span>
        </li>
        <li>
          <span>
            <strong>Authorities and other parties</strong>, when required by law, regulation,
            subpoena, court order, or legal process, or to protect the rights, property, or safety
            of EazePay, our users, or the public, and to enforce our agreements; and
          </span>
        </li>
        <li>
          <span>
            <strong>Successors</strong>, in connection with a merger, financing, acquisition,
            reorganization, bankruptcy, or sale of all or part of our assets, subject to this
            Policy.
          </span>
        </li>
      </ul>

      <h2>8. We do not sell your personal information</h2>
      <p>
        We do not sell your personal information for monetary consideration, and we do not
        &ldquo;share&rdquo; it for cross-context behavioral advertising as those terms are defined
        under California and other state laws. We do not knowingly sell or share the personal
        information of anyone under 16. If our practices change, we will update this Policy and
        provide any opt-out mechanism required by law.
      </p>

      <h2>9. Financial privacy (GLBA)</h2>
      <p>
        Certain information we handle is &ldquo;nonpublic personal information&rdquo; under the
        Gramm-Leach-Bliley Act and its implementing regulations. We limit the collection, use, and
        disclosure of such information to what is permitted by law; maintain an information-security
        program with administrative, technical, and physical safeguards designed to protect it; and
        provide the privacy notices required of financial institutions where applicable. We do not
        disclose nonpublic personal information about you except as permitted by law or as described
        in this Policy.
      </p>

      <h2>10. Cookies and similar technologies</h2>
      <p>We use the following categories of cookies and similar technologies:</p>
      <ul>
        <li>
          <span>
            <strong>Strictly necessary</strong>, required to operate the site, authenticate
            sessions, balance load, and maintain security. These cannot be switched off in our
            systems.
          </span>
        </li>
        <li>
          <span>
            <strong>Functional</strong>, remember your preferences and settings.
          </span>
        </li>
        <li>
          <span>
            <strong>Analytics / performance</strong>, help us understand how the site is used so we
            can improve it. Used only where permitted.
          </span>
        </li>
      </ul>
      <p>
        You can control non-essential cookies through your browser settings or any cookie-preference
        controls we provide. Because there is no industry-standard response, we do not currently
        respond to browser &ldquo;Do Not Track&rdquo; signals, but we honor recognized opt-out
        preference signals (such as Global Privacy Control) where required by law.
      </p>

      <h2>11. Marketing communications and your choices</h2>
      <p>
        Where permitted, we may send you marketing about features and products that may interest
        you. You can opt out at any time by following the unsubscribe instructions in our emails or
        by contacting us. We will still send you non-promotional, transactional, and administrative
        messages about your account or transactions.
      </p>

      <h2>12. Data retention</h2>
      <p>
        We retain personal information for as long as necessary to fulfill the purposes described in
        this Policy, unless a longer retention period is required or permitted by law. To determine
        the appropriate period, we consider the amount, nature, and sensitivity of the information;
        the potential risk of harm from unauthorized use or disclosure; the purposes for which we
        process it; and applicable legal, tax, accounting, audit, anti-fraud, and regulatory
        requirements. Financial and transaction records may be retained for the multi-year periods
        required by applicable law. When information is no longer needed, we delete, de-identify, or
        securely archive it.
      </p>

      <h2>13. Information security</h2>
      <p>
        We maintain a written information-security program with administrative, technical, and
        physical safeguards designed to protect information against unauthorized access, use,
        alteration, disclosure, and loss. Measures include encryption in transit and at rest,
        tokenization of sensitive payment data, role-based and least-privilege access controls,
        network segmentation, logging and monitoring, vulnerability management, vendor due
        diligence, and employee training. No method of transmission or storage is completely secure,
        and we cannot guarantee absolute security.
      </p>

      <h2>14. Automated processing and decisioning</h2>
      <p>
        The Services use automated agents and models to support intake, scoring, routing, and fraud
        prevention. EazePay does not make final credit decisions; financing decisions are made by
        independent lenders. Where required by applicable law, you may have rights with respect to
        automated decisions that produce legal or similarly significant effects, including the right
        to request human review or information about the decision. Contact us to exercise any such
        right.
      </p>

      <h2>15. Your privacy rights</h2>
      <p>
        Depending on your jurisdiction, you may have the right to: (a) know and access the personal
        information we hold about you; (b) request correction of inaccurate information; (c) request
        deletion; (d) obtain a portable copy; (e) opt out of certain processing, including any
        &ldquo;sale,&rdquo; &ldquo;sharing,&rdquo; or targeted advertising; (f) limit the use of
        sensitive information; (g) withdraw consent; and (h) be free from unlawful discrimination
        for exercising your rights.
      </p>

      <h2>16. U.S. state privacy rights</h2>
      <p>
        Residents of states with comprehensive privacy laws, including California (CCPA/CPRA),
        Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA), and a growing number of
        others, may exercise the rights granted by those laws. Note that the GLBA and other
        sector-specific laws may exempt certain financial information from some of these rights.
      </p>
      <h3>California</h3>
      <p>
        California residents may request to know, access, delete, and correct personal information,
        and may direct us not to sell or share it and to limit the use of sensitive personal
        information. We do not sell or share personal information as defined by the CPRA. You may
        designate an authorized agent to submit requests on your behalf. We will not discriminate
        against you for exercising your rights.
      </p>

      <h2>17. How to exercise your rights</h2>
      <p>
        To make a request, email <a href="mailto:support@eazepay.com">support@eazepay.com</a>. We
        will verify your identity using information reasonably necessary to confirm it before
        acting, and we will respond within the timeframe required by applicable law. If we decline a
        request, you may appeal by replying to our decision; where required by law, we will inform
        you of any further appeal options, including contacting your state attorney general.
        Authorized agents must provide proof of authorization.
      </p>

      <h2>18. International data transfers</h2>
      <p>
        We are based in the United States and may process and store information in the United States
        and other countries that may have data-protection laws different from those in your country.
        Where we transfer personal information internationally in a manner governed by the GDPR or
        UK GDPR, we use appropriate safeguards such as the European Commission&apos;s Standard
        Contractual Clauses and the UK Addendum, and we take steps to ensure your information
        receives an adequate level of protection.
      </p>

      <h2>19. Children&apos;s privacy</h2>
      <p>
        The Services are intended for adults and are not directed to children under 18, and we do
        not knowingly collect personal information from children. If you believe a child has
        provided us personal information, contact us and we will take appropriate steps to delete
        it.
      </p>

      <h2>20. Third-party links and services</h2>
      <p>
        The Services may contain links to, or interoperate with, third-party websites and services.
        We are not responsible for the privacy practices of those third parties, and we encourage
        you to review their privacy notices.
      </p>

      <h2>21. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. We will post the revised Policy with a new
        &ldquo;Last updated&rdquo; date and, where required by law, provide additional notice or
        obtain your consent. Changes are effective when posted unless stated otherwise. Your
        continued use of the Services after the effective date constitutes acceptance.
      </p>

      <h2>22. Contact us and complaints</h2>
      <p>
        If you have questions, requests, or complaints about this Policy or our privacy practices,
        contact us:
      </p>
      <p>
        EazePay Inc., Privacy Team
        <br />
        Email: <a href="mailto:support@eazepay.com">support@eazepay.com</a>
      </p>
      <p>
        If you are in the EEA or UK, you also have the right to lodge a complaint with your local
        data-protection supervisory authority, although we encourage you to contact us first so we
        can address your concern.
      </p>
    </LegalPage>
  );
}
