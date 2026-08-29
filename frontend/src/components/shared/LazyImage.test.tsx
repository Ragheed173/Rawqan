import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LazyImage } from './LazyImage';

describe('LazyImage', () => {
  it('shows an explicit fallback instead of an endless loader when no source exists', () => {
    render(<LazyImage alt="صنف بدون صورة" />);

    expect(screen.getByText('الصورة غير متوفرة')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'صنف بدون صورة' })).toBeInTheDocument();
  });

  it('shows the fallback and forwards the error event when loading fails', () => {
    const onError = vi.fn();
    render(<LazyImage alt="صنف" src="https://example.com/missing.jpg" onError={onError} />);

    fireEvent.error(screen.getByRole('img', { name: 'صنف' }));

    expect(screen.getByText('الصورة غير متوفرة')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('reveals a successfully loaded image', () => {
    render(<LazyImage alt="صنف" src="https://example.com/item.jpg" />);
    const image = screen.getByRole('img', { name: 'صنف' });

    fireEvent.load(image);

    expect(image).toHaveClass('opacity-100');
    expect(screen.queryByText('الصورة غير متوفرة')).not.toBeInTheDocument();
  });
});
