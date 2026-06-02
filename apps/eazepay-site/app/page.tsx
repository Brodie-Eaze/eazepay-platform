import { SiteNav } from './_components/SiteNav';
import { Hero } from './_components/Hero';
import { TrustBar } from './_components/TrustBar';
import { Orchestration } from './_components/Orchestration';
import { Pillars } from './_components/Pillars';
import { LeadFlow } from './_components/LeadFlow';
import { AdSignal } from './_components/AdSignal';
import { Agents } from './_components/Agents';
import { Marketplace } from './_components/Marketplace';
import { DealScope } from './_components/DealScope';
import { Industries } from './_components/Industries';
import { Proof } from './_components/Proof';
import { Faq } from './_components/Faq';
import { Cta } from './_components/Cta';
import { SiteFooter } from './_components/SiteFooter';

export default function Page() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <TrustBar />
        <Orchestration />
        <Pillars />
        <LeadFlow />
        <Agents />
        <Marketplace />
        <DealScope />
        <AdSignal />
        <Industries />
        <Proof />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
