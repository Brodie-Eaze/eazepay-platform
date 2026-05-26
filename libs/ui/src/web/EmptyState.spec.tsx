/**
 * EmptyState primitive — hermetic node specs.
 *
 * The repo doesn't ship a DOM test runtime (no jsdom / testing-library),
 * so this suite covers the pure helpers that produce the variant→class
 * mappings, plus a render-shape test that asserts <EmptyState> returns
 * a React element tree containing the expected children for each branch
 * of the prop matrix.
 *
 * Render-shape assertions walk the React element tree (no DOM mount)
 * looking for nodes with the expected className tokens. This catches
 * regressions in: variant routing, optional icon, optional description,
 * optional action(s), and the role="status" announce hook.
 */

import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import {
  EmptyState,
  emptyStateActionsRowClasses,
  emptyStateContainerClasses,
  emptyStateDescriptionClasses,
  emptyStateIconWrapClasses,
  emptyStateTitleClasses,
} from './EmptyState.js';

/* ─── Tree-walker helpers ──────────────────────────────────────────── */

function isElement(node: unknown): node is ReactElement {
  return (
    typeof node === 'object' &&
    node !== null &&
    Object.prototype.hasOwnProperty.call(node, 'type') &&
    Object.prototype.hasOwnProperty.call(node, 'props')
  );
}

function childArray(children: ReactNode): ReactNode[] {
  if (children === undefined || children === null || children === false) return [];
  return Array.isArray(children) ? children.flat(Infinity) : [children];
}

function find(node: ReactNode, pred: (el: ReactElement) => boolean): ReactElement | null {
  for (const c of childArray(node)) {
    if (!isElement(c)) continue;
    if (pred(c)) return c;
    const props = c.props as { children?: ReactNode };
    const nested = find(props.children, pred);
    if (nested) return nested;
  }
  return null;
}

function hasClass(el: ReactElement, token: string): boolean {
  const props = el.props as { className?: string };
  return typeof props.className === 'string' && props.className.includes(token);
}

/* ─── Variant→class helper tests ───────────────────────────────────── */

describe('EmptyState — variant class helpers', () => {
  it('container variant default uses the larger padding', () => {
    const cls = emptyStateContainerClasses('default');
    expect(cls).toContain('py-14');
    expect(cls).toContain('border-dashed');
    expect(cls).toContain('rounded-lg');
  });

  it('container variant inline uses tighter padding for in-card use', () => {
    const cls = emptyStateContainerClasses('inline');
    expect(cls).toContain('py-8');
    expect(cls).not.toContain('py-14');
  });

  it('icon wrap is larger for default than inline', () => {
    expect(emptyStateIconWrapClasses('default')).toContain('size-12');
    expect(emptyStateIconWrapClasses('inline')).toContain('size-9');
  });

  it('title + description tokens use semantic foreground tokens (no hex)', () => {
    expect(emptyStateTitleClasses('default')).toContain('text-fg');
    expect(emptyStateDescriptionClasses('default')).toContain('text-fg-secondary');
    expect(emptyStateActionsRowClasses('default')).toContain('mt-5');
    expect(emptyStateActionsRowClasses('inline')).toContain('mt-3');
  });
});

/* ─── Render-shape tests ───────────────────────────────────────────── */

describe('EmptyState — render shape', () => {
  it('renders title heading + role="status" container', () => {
    const tree = EmptyState({ title: 'Nothing here' }) as ReactElement;
    const props = tree.props as { role?: string };
    expect(props.role).toBe('status');
    const heading = find(tree, (el) => el.type === 'h3');
    expect(heading).not.toBeNull();
  });

  it('omits the icon wrapper when icon prop is not supplied', () => {
    const tree = EmptyState({ title: 'No icon case' }) as ReactElement;
    const iconWrap = find(tree, (el) => hasClass(el, 'rounded-full'));
    expect(iconWrap).toBeNull();
  });

  it('renders the icon wrapper when icon prop is supplied', () => {
    const tree = EmptyState({
      title: 'With icon',
      icon: 'i' as unknown as ReactNode,
    }) as ReactElement;
    const iconWrap = find(tree, (el) => hasClass(el, 'rounded-full'));
    expect(iconWrap).not.toBeNull();
  });

  it('omits the description paragraph when description is absent', () => {
    const tree = EmptyState({ title: 'No body' }) as ReactElement;
    const p = find(tree, (el) => el.type === 'p');
    expect(p).toBeNull();
  });

  it('renders the description paragraph when description is supplied', () => {
    const tree = EmptyState({
      title: 'With body',
      description: 'Detail line',
    }) as ReactElement;
    const p = find(tree, (el) => el.type === 'p');
    expect(p).not.toBeNull();
  });

  it('renders an actions row only when at least one action is supplied', () => {
    const noneTree = EmptyState({ title: 'No actions' }) as ReactElement;
    expect(find(noneTree, (el) => hasClass(el, 'mt-5'))).toBeNull();

    const withTree = EmptyState({
      title: 'With actions',
      action: 'A' as unknown as ReactNode,
      secondaryAction: 'B' as unknown as ReactNode,
    }) as ReactElement;
    const actionsRow = find(withTree, (el) => hasClass(el, 'mt-5'));
    expect(actionsRow).not.toBeNull();
  });

  it('inline variant routes container + actions row to the tighter spacing', () => {
    const tree = EmptyState({
      title: 'Inline',
      variant: 'inline',
      action: 'A' as unknown as ReactNode,
    }) as ReactElement;
    expect(hasClass(tree, 'py-8')).toBe(true);
    const actionsRow = find(tree, (el) => hasClass(el, 'mt-3'));
    expect(actionsRow).not.toBeNull();
  });
});
