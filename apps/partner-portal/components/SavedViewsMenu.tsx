'use client';
/**
 * SavedViewsMenu — dropdown above any list/dashboard surface that
 * snapshots the current URL search params into a named view and
 * surfaces previously-saved ones for the same `surface`.
 *
 * Wiring (per-surface):
 *
 *   import { SavedViewsMenu } from '@/components/SavedViewsMenu';
 *   <SavedViewsMenu surface="/applications" />
 *
 * Pinned views additionally render in the sidebar via the
 * `<PinnedViewsRail>` consumed in `app/_shell.tsx`.
 *
 * State + persistence lives in `lib/saved-views.ts` (localStorage).
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  Input,
  ChevronDownIcon,
} from '@eazepay/ui/web';
import {
  createView,
  deleteView,
  listViewsForSurface,
  pinView,
  viewToHref,
  type SavedView,
} from '../lib/saved-views';

interface SavedViewsMenuProps {
  surface: string;
  /** Override the button label (defaults to "Views"). */
  label?: string;
}

export function SavedViewsMenu({ surface, label = 'Views' }: SavedViewsMenuProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [views, setViews] = useState<SavedView[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');

  // Read on mount + every save / pin / delete + cross-tab nudge.
  const refresh = () => setViews(listViewsForSurface(surface));
  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'eazepay_saved_views_v1' || e.key === null) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface]);

  const currentFilters = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    searchParams?.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }, [searchParams]);

  const hasFilters = Object.keys(currentFilters).length > 0;

  const onSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createView({ name: trimmed, surface, filters: currentFilters });
    setName('');
    setSaveOpen(false);
    refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" trailingIcon={<ChevronDownIcon size={12} />}>
            {label}
            {views.length > 0 && (
              <span className="ml-1.5 text-[10px] text-fg-muted">{views.length}</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          {views.length === 0 ? (
            <div className="px-2 py-3 text-[12px] text-fg-muted">
              No saved views yet for this surface.
            </div>
          ) : (
            views.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onSelect={(e) => {
                  // Block the auto-close so the pin/delete buttons in
                  // the row can act without re-opening the dropdown.
                  e.preventDefault();
                  router.push(viewToHref(v));
                }}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      pinView(v.id, !v.pinnedToSidebar);
                      refresh();
                    }}
                    className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded hover:bg-bg-muted"
                    aria-label={v.pinnedToSidebar ? 'Unpin from sidebar' : 'Pin to sidebar'}
                    title={v.pinnedToSidebar ? 'Unpin from sidebar' : 'Pin to sidebar'}
                  >
                    {v.pinnedToSidebar ? 'Pinned' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      deleteView(v.id);
                      refresh();
                    }}
                    className="text-[10px] text-fg-muted hover:text-rose-500 px-1.5 py-0.5"
                    aria-label="Delete view"
                    title="Delete view"
                  >
                    ×
                  </button>
                </span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setSaveOpen(true);
            }}
            disabled={!hasFilters}
          >
            Save current view
            {!hasFilters && (
              <span className="ml-2 text-[10px] text-fg-muted">(no filters applied)</span>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>
              Snapshots the current filter state so you can return to it in one click.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <label className="block text-[12px] font-medium text-fg-secondary mb-1">
              View name
            </label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Funded · last 7 days"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
              }}
            />
            <p className="mt-3 text-[11px] text-fg-muted">
              {Object.keys(currentFilters).length} filter
              {Object.keys(currentFilters).length === 1 ? '' : 's'} captured.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button size="sm" onClick={onSave} disabled={!name.trim()}>
              Save view
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
