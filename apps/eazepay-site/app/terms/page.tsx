import type { Metadata } from 'next';
import { LegalPage } from '../_components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern your access to and use of the websites and services provided by EazePay Inc.',
};

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Service"
      updated="June 2, 2026"
      intro={
        <>
          These Terms of Service (the &ldquo;Terms&rdquo;) govern your access to and use of the
          websites, applications, and services provided by <strong>EazePay Inc.</strong>{' '}
          (&ldquo;EazePay,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
          (collectively, the &ldquo;Services&rdquo;). By accessing or using the Services, or by
          clicking to accept, you agree to be bound by these Terms. If you do not agree, do not use
          the Services. If you use the Services on behalf of an organization, you represent that you
          are authorized to bind that organization, and &ldquo;you&rdquo; refers to that
          organization.
        </>
      }
    >
      <h2>1. Eligibility and accounts</h2>
      <p>
        You must be at least 18 years old and capable of forming a binding contract to use the
        Services. If we provide you an account, you are responsible for maintaining the
        confidentiality of your credentials and for all activity under your account. You agree to
        provide accurate information and to keep it current, and to notify us promptly of any
        unauthorized use.
      </p>

      <h2>2. The Services</h2>
      <p>
        EazePay provides financial infrastructure, including prequalification software, automated
        decisioning agents, a lender marketplace, and payment processing, that powers branded
        experiences such as MedPay, TradePay, CoachPay, and VetPay. EazePay is a technology
        provider. EazePay is not a bank, is not a lender, and does not extend credit or make credit
        decisions on its own behalf. Financing, where offered, is originated and provided by
        independent third-party lenders that are solely responsible for their own products, credit
        decisions, disclosures, and loan agreements. Payment processing is provided through
        relationships with sponsoring financial institutions and processors.
      </p>

      <h2>3. No financial, legal, or tax advice</h2>
      <p>
        Content provided through the Services is for general informational purposes only and does
        not constitute financial, legal, tax, or other professional advice. You are responsible for
        evaluating whether the Services and any third-party offers are appropriate for you and for
        obtaining independent advice as needed.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to, and not to permit others to:</p>
      <ul>
        <li>
          <span>Use the Services in violation of any applicable law or regulation;</span>
        </li>
        <li>
          <span>
            Submit false, misleading, or fraudulent information, or impersonate any person or
            entity;
          </span>
        </li>
        <li>
          <span>
            Attempt to gain unauthorized access to, interfere with, or disrupt the Services or
            related systems;
          </span>
        </li>
        <li>
          <span>
            Reverse engineer, decompile, scrape, or copy any part of the Services except as
            permitted by law;
          </span>
        </li>
        <li>
          <span>
            Use the Services to launder money, finance illegal activity, or evade sanctions; or
          </span>
        </li>
        <li>
          <span>
            Infringe the intellectual-property or privacy rights of others or upload malicious code.
          </span>
        </li>
      </ul>

      <h2>5. Third-party services and lenders</h2>
      <p>
        The Services may route applications to, or interoperate with, third parties including
        lenders, processors, and verification vendors. We do not control and are not responsible for
        third-party products, services, terms, or conduct. Your use of a third party&apos;s offering
        is governed by that third party&apos;s agreements, and any credit or financing relationship
        is solely between you and that third party.
      </p>

      <h2>6. Fees</h2>
      <p>
        Where you are a business customer, applicable fees, billing, and payment terms are set out
        in your order form or commercial agreement with us. Unless otherwise agreed, fees are
        exclusive of taxes, which are your responsibility. Use of the public website is free.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The Services, including all software, text, graphics, logos, and trademarks, are owned by
        EazePay Inc. or its licensors and are protected by intellectual-property laws. Subject to
        these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to
        access and use the Services for their intended purpose. All rights not expressly granted are
        reserved. &ldquo;EazePay,&rdquo; &ldquo;MedPay,&rdquo; &ldquo;TradePay,&rdquo;
        &ldquo;CoachPay,&rdquo; and &ldquo;VetPay&rdquo; are brands of EazePay Inc.
      </p>

      <h2>8. Your content and submissions</h2>
      <p>
        You retain ownership of information you submit. You grant us a worldwide, royalty-free
        license to use, host, process, and transmit that information as necessary to provide the
        Services and as described in our <a href="/privacy">Privacy Policy</a>. You represent that
        you have the rights necessary to provide it and that it is accurate.
      </p>

      <h2>9. Privacy</h2>
      <p>
        Our collection and use of personal information is described in our{' '}
        <a href="/privacy">Privacy Policy</a>, which is incorporated into these Terms by reference.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
        WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES
        OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT
        WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY
        APPLICATION WILL BE APPROVED BY A THIRD-PARTY LENDER.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, EAZEPAY INC. AND ITS AFFILIATES, OFFICERS,
        EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR
        GOODWILL, ARISING OUT OF OR RELATING TO THE SERVICES. OUR TOTAL LIABILITY FOR ANY CLAIM WILL
        NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICES IN THE TWELVE MONTHS
        BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100). SOME
        JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO SOME OF THE ABOVE MAY NOT APPLY TO YOU.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless EazePay Inc. and its affiliates from any claims,
        liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of
        or related to your use of the Services, your content, or your violation of these Terms or of
        applicable law.
      </p>

      <h2>13. Termination</h2>
      <p>
        We may suspend or terminate your access to the Services at any time, with or without notice,
        if we believe you have violated these Terms or applicable law, or to protect the Services or
        other users. You may stop using the Services at any time. Provisions that by their nature
        should survive termination will survive.
      </p>

      <h2>14. Governing law and dispute resolution</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, without regard to its
        conflict-of-laws rules. Except where prohibited by law, any dispute arising out of or
        relating to these Terms or the Services will be resolved by binding individual arbitration,
        and you and EazePay Inc. waive any right to a jury trial and to participate in a class
        action. You may opt out of arbitration within 30 days of first accepting these Terms by
        emailing <a href="mailto:legal@eazepay.com">legal@eazepay.com</a>.
      </p>

      <h2>15. Changes to these Terms</h2>
      <p>
        We may modify these Terms from time to time. We will post the updated Terms with a new
        &ldquo;Last updated&rdquo; date and, where required, provide additional notice. Your
        continued use of the Services after changes take effect constitutes acceptance of the
        updated Terms.
      </p>

      <h2>16. Miscellaneous</h2>
      <p>
        These Terms, together with any order form and our Privacy Policy, are the entire agreement
        between you and EazePay Inc. regarding the Services. If any provision is held unenforceable,
        the remaining provisions remain in effect. Our failure to enforce a provision is not a
        waiver. You may not assign these Terms without our consent; we may assign them in connection
        with a merger, acquisition, or sale of assets.
      </p>

      <h2>17. Contact us</h2>
      <p>
        EazePay Inc. — Legal
        <br />
        Email: <a href="mailto:legal@eazepay.com">legal@eazepay.com</a>
        <br />
        General: <a href="mailto:hello@eazepay.com">hello@eazepay.com</a>
      </p>
    </LegalPage>
  );
}
