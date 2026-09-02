import { describe, expect, it } from 'vitest';
import type { WarungState } from '@/context/WarungContext';
import { appendOrderItems, cancelActiveOrder, submitOrder } from './warungTransactions';

function state(): WarungState {
  return {
    menus: [{ id: 'miso', name: 'Miso', price: 12_000, recipe: { noodles: 1 } }],
    inventory: [{ id: 'noodles', name: 'Mie', unit: 'pcs', qty: 2, safe: 1 }],
    consignments: [{
      id: 'cracker',
      name: 'Kerupuk',
      cost: 10_000,
      sellPrice: 2_000,
      packSize: 10,
      qty: 2,
    }],
    activeOrders: [],
    kitchenOrders: [],
    expenses: [],
    sales: [],
    savingsRules: [],
    savingsEntries: [],
  };
}

describe('transaction stock accounting', () => {
  it('consumes stock once on submit and once when adding items', () => {
    const draft = [{ menu: 'miso', qty: 1 }];
    const beforeSubmit = state();
    expect(beforeSubmit.inventory[0].qty).toBe(2);

    const submitted = submitOrder(
      beforeSubmit,
      { tables: [1], pax: 1, items: draft, note: '' },
      () => 'order-1',
      '10:00',
    );
    expect(submitted.inventory[0].qty).toBe(1);
    expect(submitted.activeOrders[0].items[0]).toMatchObject({
      displayName: 'Miso',
      unitPrice: 12_000,
      recipe: { noodles: 1 },
    });

    const appended = appendOrderItems(submitted, 'order-1', draft, '', () => 'additional-1');
    expect(appended.inventory[0].qty).toBe(0);
    expect(appended.activeOrders[0].items[0].qty).toBe(2);
  });

  it('restores ingredient and consignment stock when an uncooked order is cancelled', () => {
    const submitted = submitOrder(
      state(),
      {
        tables: [1],
        pax: 1,
        items: [
          { menu: 'miso', qty: 1 },
          { menu: 'consignment:cracker', qty: 2 },
        ],
        note: '',
      },
      () => 'order-1',
      '10:00',
    );
    expect(submitted.inventory[0].qty).toBe(1);
    expect(submitted.consignments[0].qty).toBe(0);

    const cancelled = cancelActiveOrder(submitted, 'order-1');
    expect(cancelled.inventory[0].qty).toBe(2);
    expect(cancelled.consignments[0].qty).toBe(2);
    expect(cancelled.activeOrders).toHaveLength(0);
    expect(cancelled.kitchenOrders).toHaveLength(0);
  });

  it('rejects an order when combined requested stock is unavailable', () => {
    const initial = state();
    const result = submitOrder(
      initial,
      {
        tables: [1],
        pax: 1,
        items: [{ menu: 'miso', qty: 3 }],
        note: '',
      },
      () => 'order-1',
      '10:00',
    );
    expect(result).toBe(initial);
  });
});