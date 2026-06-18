import { describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DocumentText } from './DocumentText';
import type { DocumentJSON } from '../config/types';

afterEach(() => cleanup());

const doc: DocumentJSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'First line of the order.' }],
    },
    {
      type: 'paragraph',
      attrs: { align: null, indent: 0, lineHeight: null },
      content: [{ type: 'text', text: 'Second line.' }],
    },
  ],
};

describe('<DocumentText>', () => {
  it('renders plain text from document JSON (string or object)', () => {
    const { container, rerender } = render(<DocumentText value={doc} />);
    expect(container.textContent).toContain('First line of the order.');
    expect(container.textContent).toContain('Second line.');

    rerender(<DocumentText value={JSON.stringify(doc)} />);
    expect(container.textContent).toContain('First line of the order.');
  });

  it('renders a legacy plain-text string verbatim (not document JSON)', () => {
    const { container } = render(<DocumentText value="Just plain legacy text." />);
    expect(container.textContent).toBe('Just plain legacy text.');

    // A non-document JSON value still falls back to its string form.
    const numeric = render(<DocumentText value="42" />);
    expect(numeric.container.textContent).toBe('42');
  });

  it('does not emit HTML markup (text only)', () => {
    const xss: DocumentJSON = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { align: null, indent: 0, lineHeight: null },
          content: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }],
        },
      ],
    };
    const { container } = render(<DocumentText value={xss} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('applies a line clamp and the empty fallback', () => {
    const { container } = render(<DocumentText value={doc} clamp={2} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue('-webkit-line-clamp')).toBe('2');

    const empty = render(<DocumentText value={null} empty="No content" />);
    expect(empty.container.textContent).toBe('No content');
  });
});
