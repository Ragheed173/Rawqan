import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="لا توجد نتائج" description="جرّب تعديل البحث" />);
    expect(screen.getByText('لا توجد نتائج')).toBeInTheDocument();
    expect(screen.getByText('جرّب تعديل البحث')).toBeInTheDocument();
  });

  it('renders an action when provided', () => {
    render(<EmptyState title="فارغ" action={<button>إضافة</button>} />);
    expect(screen.getByRole('button', { name: 'إضافة' })).toBeInTheDocument();
  });
});
