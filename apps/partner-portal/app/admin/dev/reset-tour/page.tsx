'use client';

/**
 * /admin/dev/reset-tour — hidden operator action.
 *
 * Wipes every `partner-tour-seen-{partnerId}` flag from localStorage so
 * the next partner-portal landing re-fires the first-run tour. Used
 * during demos so the operator can replay the walk-through for any
 * partner without forging cookies or going incognito.
 *
 * Intentionally not linked from any nav — operators reach it via the
 * URL bar. (Listing it would erode trust: a real merchant who stumbled
 * onto a "reset your tour" button might assume their state was being
 * mutated by support without consent.)
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  EmptyState,
  CheckIcon,
} from '@eazepay/ui/web';
import { clearAllPartnerTours } from '../../../../components/PartnerTour';

export default function ResetTourPage(): JSX.Element {
  const [cleared, setCleared] = useState<number | null>(null);

  function reset() {
    const n = clearAllPartnerTours();
    setCleared(n);
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Dev tools' },
          { label: 'Reset tour' },
        ]}
        title="Reset first-run tour"
        description="Wipes every partner-tour-seen flag in this browser's localStorage. The next partner-portal landing will re-fire the 4-step tour."
      />
      <PageBody>
        <Card>
          <CardBody>
            {cleared === null ? (
              <EmptyState
                title="Ready to reset"
                description="Click below to clear every persisted tour-seen flag for this browser session. Affects only this browser — other operators are unaffected."
                action={
                  <Button variant="primary" onClick={reset}>
                    Reset tour state
                  </Button>
                }
                secondaryAction={
                  <Link
                    href="/admin"
                    className="inline-flex items-center text-[13px] font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm"
                  >
                    Back to admin
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={<CheckIcon size={20} />}
                title={
                  cleared === 0
                    ? 'Nothing to clear'
                    : `Cleared ${cleared} tour flag${cleared === 1 ? '' : 's'}`
                }
                description="Open any /v/[brand] landing page to see the tour re-fire."
                action={
                  <Button variant="ghost" onClick={() => setCleared(null)}>
                    Reset again
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
