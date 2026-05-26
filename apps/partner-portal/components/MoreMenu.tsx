'use client';
/**
 * MoreMenu — topbar escape hatch for surfaces that were removed from
 * the master sidebar in Sprint I's IA cleanup. The sidebar now carries
 * only daily-driver items (WORK / NETWORK / TOOLS); everything else
 * (admin shortcuts, marketplace, low-frequency tools) is one click
 * away here without bloating the left rail.
 *
 * Master surface only — hidden on per-brand portals so merchants never
 * see admin / cross-tenant links.
 *
 * Source of truth for what lives here: docs/ia-rationalization.md
 * (table: "What moved where").
 */
import { useRouter } from 'next/navigation';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  SettingsIcon,
  StoreIcon,
  ShieldIcon,
  ChartIcon,
  DocIcon,
  GaugeIcon,
  ChevronDownIcon,
} from '@eazepay/ui/web';

export function MoreMenu() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Open more menu"
          trailingIcon={<ChevronDownIcon size={12} />}
        >
          More
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Operator tools</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => router.push('/control-panel')}>
          <SettingsIcon size={14} /> Control Panel
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/marketplace')}>
          <StoreIcon size={14} /> Marketplace
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Platform admin</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => router.push('/admin')}>
          <ShieldIcon size={14} /> Control Plane
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/admin/observability')}>
          <GaugeIcon size={14} /> Observability
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/admin/observability/slo')}>
          <ChartIcon size={14} /> SLO Board
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/admin/audit')}>
          <DocIcon size={14} /> Audit Log
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Developer</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => router.push('/sandbox')}>
          <GaugeIcon size={14} /> Sandbox
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/api-keys')}>
          <ShieldIcon size={14} /> API Keys
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/docs')}>
          <DocIcon size={14} /> Documentation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
