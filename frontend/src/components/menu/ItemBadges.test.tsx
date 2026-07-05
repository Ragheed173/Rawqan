import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ItemBadges } from './ItemBadges';
import type { MenuItem } from '@/types';

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    isBestSeller: false,
    isChefRecommendation: false,
    isNew: false,
    isVegetarian: false,
    spiceLevel: 'NONE',
    ...overrides,
  } as MenuItem;
}

describe('ItemBadges', () => {
  it('renders nothing when the item has no flags', () => {
    const { container } = render(<ItemBadges item={makeItem()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the best-seller badge', () => {
    render(<ItemBadges item={makeItem({ isBestSeller: true })} />);
    expect(screen.getByText('الأكثر مبيعاً')).toBeInTheDocument();
  });

  it('shows the hot badge only when spiceLevel is HOT', () => {
    render(<ItemBadges item={makeItem({ spiceLevel: 'MEDIUM' })} />);
    expect(screen.queryByText('حار')).not.toBeInTheDocument();
  });

  it('renders every applicable badge together', () => {
    render(
      <ItemBadges
        item={makeItem({
          isBestSeller: true,
          isChefRecommendation: true,
          isNew: true,
          isVegetarian: true,
          spiceLevel: 'HOT',
        })}
      />,
    );
    for (const label of ['الأكثر مبيعاً', 'اختيار الشيف', 'جديد', 'نباتي', 'حار']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
