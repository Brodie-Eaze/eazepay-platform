import type { Metadata } from 'next';
import { LegalPage } from '../_components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern your access to and use of the websites, applications, and services provided by EazePay Inc., including disclaimers, liability limits, and dispute resolution.',
};

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Service"
      updated="June 2, 2026"
      intro={
        <>
          These Terms of Service (the &ldquo;Terms&rdquo;) are a binding agreement between you and{' '}
          <strong>EazePay Inc.</strong> (&ldquo;EazePay,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
          or &ldquo;our&rdquo;) and govern your access to and use of our websites, applications,
          APIs, SDKs, and services (collectively, the &ldquo;Services&rdquo;). By accessing or using
          the Services, or by clicking to accept, you agree to these Terms and to our{' '}
          <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the Services. If
          you use the Services on behalf of an organization, you represent that you are authorized
          to bind that organization, and &ldquo;you&rdquo; refers to that organization.{' '}
          <strong>
            These Terms contain a binding arbitration agreement and a class-action waiver in Section
            18 that affect your legal rights.
          </strong>
        </>
      }
    >
      <h2>1. Definitions</h2>
      <ul>
        <li>
          <span>
            <strong>&ldquo;Services&rdquo;</strong>, the EazePay websites, hosted pages,
            applications, APIs, SDKs, documentation, and related products and support.
          </span>
        </li>
        <li>
          <span>
            <strong>&ldquo;Lender&rdquo;</strong>, an independent third-party financial institution
            or creditor that evaluates and provides financing through the marketplace.
          </span>
        </li>
        <li>
          <span>
            <strong>&ldquo;Business Customer&rdquo;</strong>, a merchant, partner, or organization
            that uses the Services under a commercial agreement with us.
          </span>
        </li>
        <li>
          <span>
            <strong>&ldquo;Content&rdquo;</strong>, information, data, text, and materials you
            submit to or through the Services.
          </span>
        </li>
      </ul>

      <h2>2. Eligibility and accounts</h2>
      <p>
        You must be at least 18 years old and able to form a binding contract to use the Services.
        If we provide you an account, you are responsible for keeping your credentials confidential
        and for all activity under your account. You agree to provide accurate, current, and
        complete information, to keep it updated, and to notify us promptly of any unauthorized use
        or security breach. We may refuse, suspend, or terminate accounts at our discretion as
        permitted by law.
      </p>

      <h2>3. The Services; our role</h2>
      <p>
        EazePay provides financial infrastructure, including prequalification, automated decisioning
        agents, a lender marketplace, an orchestration waterfall, application tracking, and payment
        processing, that powers branded experiences such as MedPay, TradePay, CoachPay, and VetPay.{' '}
        <strong>EazePay is a technology provider.</strong> EazePay is not a bank, is not a lender,
        and does not extend credit or make credit decisions on its own behalf. Financing, where
        offered, is originated and provided by independent Lenders that are solely responsible for
        their own products, underwriting, credit decisions, disclosures, and loan agreements.
        Payment processing is provided through relationships with sponsoring financial institutions
        and processors. We may add, change, or discontinue features of the Services at any time.
      </p>

      <h2>4. No financial, legal, or tax advice</h2>
      <p>
        Content provided through the Services is for general informational purposes only and does
        not constitute financial, legal, tax, accounting, or other professional advice, and is not a
        recommendation to enter into any transaction. You are responsible for evaluating whether the
        Services and any third-party offers are appropriate for you and for obtaining independent
        advice. Any credit terms, rates, and disclosures are provided by the Lender, not by EazePay.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to, and not to permit any third party to:</p>
      <ul>
        <li>
          <span>Use the Services in violation of any applicable law, regulation, or rule;</span>
        </li>
        <li>
          <span>
            Submit false, inaccurate, misleading, or fraudulent information, or impersonate any
            person or entity;
          </span>
        </li>
        <li>
          <span>
            Attempt to gain unauthorized access to, probe, scan, interfere with, or disrupt the
            Services, related systems, or other users;
          </span>
        </li>
        <li>
          <span>
            Reverse engineer, decompile, disassemble, scrape, or copy any part of the Services
            except to the extent permitted by law;
          </span>
        </li>
        <li>
          <span>
            Use the Services to launder money, finance terrorism or other illegal activity, or evade
            sanctions or export controls;
          </span>
        </li>
        <li>
          <span>
            Infringe the intellectual-property, privacy, or other rights of others, or upload
            viruses or malicious code;
          </span>
        </li>
        <li>
          <span>
            Resell, sublicense, or use the Services to build a competing product, or exceed rate
            limits or usage allowances; or
          </span>
        </li>
        <li>
          <span>
            Use the Services in any way that could harm EazePay, the Services, or any person.
          </span>
        </li>
      </ul>

      <h2>6. Third-party services and Lenders</h2>
      <p>
        The Services route applications to, and interoperate with, third parties including Lenders,
        processors, networks, and verification vendors. We do not control and are not responsible
        for third-party products, services, terms, decisions, or conduct, including whether any
        application is approved or on what terms. Your use of a third party&apos;s offering is
        governed by that third party&apos;s agreements, and any credit or financing relationship is
        solely between you and that third party.
      </p>

      <h2>7. Fees and payment</h2>
      <p>
        Use of the public website is free. Where you are a Business Customer, applicable fees,
        billing, and payment terms are set out in your order form or commercial agreement with us.
        Unless otherwise agreed, fees are non-refundable and exclusive of taxes, which are your
        responsibility. We may suspend the Services for non-payment after notice as permitted by
        law.
      </p>

      <h2>8. APIs, SDKs, and sandbox</h2>
      <p>
        If we provide APIs, SDKs, or a sandbox or beta environment, you may use them only in
        accordance with our documentation and any usage limits. Sandbox and beta features are
        provided &ldquo;as is,&rdquo; may change or be withdrawn at any time, may not be as reliable
        as production features, and must not be used to process real consumer or payment data unless
        we expressly say so. We may monitor usage to ensure compliance and protect the Services.
      </p>

      <h2>9. Intellectual property</h2>
      <p>
        The Services, including all software, text, graphics, designs, logos, and trademarks, are
        owned by EazePay Inc. or its licensors and are protected by intellectual-property laws.
        Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable
        license to access and use the Services for their intended purpose. All rights not expressly
        granted are reserved. &ldquo;EazePay,&rdquo; &ldquo;MedPay,&rdquo; &ldquo;TradePay,&rdquo;
        &ldquo;CoachPay,&rdquo; and &ldquo;VetPay&rdquo; are brands of EazePay Inc.; you may not use
        them without our prior written permission.
      </p>

      <h2>10. Your Content</h2>
      <p>
        You retain ownership of your Content. You grant us a worldwide, royalty-free, sublicensable
        license to host, store, reproduce, process, transmit, and display your Content as necessary
        to operate and provide the Services and as described in our{' '}
        <a href="/privacy">Privacy Policy</a>. You represent and warrant that you have the rights
        necessary to provide your Content, that it is accurate, and that it does not violate these
        Terms or any law or third-party right.
      </p>

      <h2>11. Feedback</h2>
      <p>
        If you provide suggestions, ideas, or feedback about the Services, you grant us a perpetual,
        irrevocable, worldwide, royalty-free license to use it without restriction or obligation to
        you.
      </p>

      <h2>12. Electronic communications and consent (E-SIGN)</h2>
      <p>
        By using the Services, you consent to receive communications from us electronically,
        including by email and through the Services, and you agree that electronic agreements,
        notices, disclosures, and other communications satisfy any legal requirement that they be in
        writing. You may withdraw this consent by closing your account, but doing so may prevent you
        from using certain Services.
      </p>

      <h2>13. Compliance, export, and sanctions</h2>
      <p>
        You agree to comply with all applicable laws in connection with your use of the Services,
        including anti-money-laundering, anti-corruption, export-control, and economic-sanctions
        laws. You represent that you are not located in, organized under the laws of, or ordinarily
        resident in a sanctioned jurisdiction, and that you are not a person with whom dealings are
        prohibited under applicable sanctions programs.
      </p>

      <h2>14. Disclaimers</h2>
      <p>
        THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
        WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES
        OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT, AND ANY
        WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. WE DO NOT WARRANT THAT THE
        SERVICES WILL BE UNINTERRUPTED, TIMELY, ERROR-FREE, OR SECURE, THAT DEFECTS WILL BE
        CORRECTED, OR THAT ANY APPLICATION WILL BE APPROVED BY A LENDER. SOME JURISDICTIONS DO NOT
        ALLOW THE EXCLUSION OF CERTAIN WARRANTIES, SO SOME EXCLUSIONS MAY NOT APPLY TO YOU.
      </p>

      <h2>15. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, EAZEPAY INC. AND ITS AFFILIATES, OFFICERS,
        DIRECTORS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA,
        GOODWILL, OR BUSINESS, ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICES, WHETHER
        BASED ON CONTRACT, TORT, STRICT LIABILITY, OR ANY OTHER THEORY, EVEN IF ADVISED OF THE
        POSSIBILITY OF SUCH DAMAGES. OUR TOTAL CUMULATIVE LIABILITY FOR ALL CLAIMS WILL NOT EXCEED
        THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICES IN THE TWELVE MONTHS BEFORE THE
        EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100). THESE LIMITATIONS
        ARE AN ESSENTIAL BASIS OF THE BARGAIN. SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS,
        SO SOME OF THE ABOVE MAY NOT APPLY TO YOU.
      </p>

      <h2>16. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold harmless EazePay Inc. and its affiliates, officers,
        directors, employees, and agents from and against any claims, liabilities, damages, losses,
        and expenses, including reasonable legal fees, arising out of or related to your use of the
        Services, your Content, your violation of these Terms, or your violation of any law or
        third-party right.
      </p>

      <h2>17. Term and termination</h2>
      <p>
        These Terms apply while you use the Services. We may suspend or terminate your access at any
        time, with or without notice, if we believe you have violated these Terms or applicable law,
        or to protect the Services or others. You may stop using the Services at any time. Upon
        termination, your license to use the Services ends; Sections that by their nature should
        survive, including Sections 9 to 11 and 14 to 22, will survive.
      </p>

      <h2>18. Governing law; arbitration; class-action waiver</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, without regard to its
        conflict-of-laws rules. Except where prohibited by law, any dispute, claim, or controversy
        arising out of or relating to these Terms or the Services will be resolved by{' '}
        <strong>binding individual arbitration</strong> administered by a recognized arbitration
        provider under its rules, rather than in court, except that either party may bring an
        individual claim in small-claims court or seek injunctive relief for intellectual-property
        misuse.
      </p>
      <p>
        <strong>
          You and EazePay Inc. waive any right to a jury trial and to participate in a class,
          collective, or representative action.
        </strong>{' '}
        Arbitration will be conducted on an individual basis only. You may opt out of this
        arbitration agreement by emailing{' '}
        <a href="mailto:support@eazepay.com">support@eazepay.com</a> within 30 days of first
        accepting these Terms, stating your intent to opt out. If any portion of this Section is
        found unenforceable, the remainder will continue to apply.
      </p>

      <h2>19. Force majeure</h2>
      <p>
        We are not liable for any delay or failure to perform resulting from causes beyond our
        reasonable control, including acts of God, natural disasters, war, terrorism, civil unrest,
        labor disputes, governmental action, power or internet failures, or third-party service
        outages.
      </p>

      <h2>20. Assignment</h2>
      <p>
        You may not assign or transfer these Terms or your rights under them without our prior
        written consent. We may assign these Terms in connection with a merger, acquisition,
        reorganization, financing, or sale of assets, or otherwise as permitted by law. These Terms
        bind and benefit the parties and their permitted successors and assigns.
      </p>

      <h2>21. Notices</h2>
      <p>
        We may provide notices to you by email, through the Services, or by posting on our website.
        You may send legal notices to us at{' '}
        <a href="mailto:support@eazepay.com">support@eazepay.com</a>. Notices are deemed received
        when sent (for electronic notices) or when posted.
      </p>

      <h2>22. Miscellaneous</h2>
      <p>
        These Terms, together with any order form and our <a href="/privacy">Privacy Policy</a>, are
        the entire agreement between you and EazePay Inc. regarding the Services and supersede any
        prior agreements. If any provision is held unenforceable, it will be limited or severed to
        the minimum extent necessary, and the remaining provisions will remain in full force. Our
        failure to enforce a provision is not a waiver. Section headings are for convenience only.
        There are no third-party beneficiaries to these Terms.
      </p>

      <h2>23. Contact us</h2>
      <p>
        EazePay Inc., Legal
        <br />
        Email: <a href="mailto:support@eazepay.com">support@eazepay.com</a>
      </p>
    </LegalPage>
  );
}
