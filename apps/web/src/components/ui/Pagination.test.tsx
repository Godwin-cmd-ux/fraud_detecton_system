import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

afterEach(cleanup);
it('shows a window with endpoints and advances to the next page', () => {
  const onChange = vi.fn();
  render(<Pagination page={5} totalPages={20} onChange={onChange} />);
  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Previous', '1', '3', '4', '5', '6', '7', '20', 'Next']);
  expect(screen.getAllByText('…')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Page 5' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(onChange).toHaveBeenCalledWith(6);
});
it('disables navigation at the ends and hides single-page lists', () => {
  const { rerender } = render(<Pagination page={1} totalPages={3} onChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  rerender(<Pagination page={3} totalPages={3} onChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  rerender(<Pagination page={1} totalPages={1} onChange={vi.fn()} />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
