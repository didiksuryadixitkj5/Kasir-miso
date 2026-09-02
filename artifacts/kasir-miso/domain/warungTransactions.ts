import type {
  ActiveOrder,
  ConsignmentItem,
  InventoryItem,
  MenuItem,
  OrderItem,
  WarungState,
} from '@/context/WarungContext';

const isConsignmentKey = (key: string) => key.startsWith('consignment:');
const consignmentIdFromKey = (key: string) => key.replace(/^consignment:/, '');

function mergeItems(...groups: OrderItem[][]) {
  return groups.flat().reduce<OrderItem[]>((items, item) => {
    const existingIndex = items.findIndex((entry) => entry.menu === item.menu
      && entry.displayName === item.displayName
      && entry.unitPrice === item.unitPrice
      && entry.consignmentUnitCost === item.consignmentUnitCost
      && JSON.stringify(entry.recipe ?? null) === JSON.stringify(item.recipe ?? null));
    if (existingIndex >= 0) {
      items[existingIndex] = { ...items[existingIndex], qty: items[existingIndex].qty + item.qty };
    } else {
      items.push({ ...item });
    }
    return items;
  }, []);
}

function snapshotItems(items: OrderItem[], menus: MenuItem[], consignments: ConsignmentItem[]) {
  return items.map((item) => {
    if (isConsignmentKey(item.menu)) {
      const consignment = consignments.find((entry) => entry.id === consignmentIdFromKey(item.menu));
      return {
        ...item,
        displayName: item.displayName ?? consignment?.name,
        unitPrice: item.unitPrice ?? consignment?.sellPrice,
        consignmentUnitCost: item.consignmentUnitCost
          ?? (consignment && consignment.packSize > 0 ? consignment.cost / consignment.packSize : undefined),
      };
    }
    const menu = menus.find((entry) => entry.id === item.menu);
    return {
      ...item,
      displayName: item.displayName ?? menu?.name,
      unitPrice: item.unitPrice ?? menu?.price,
      recipe: item.recipe ?? menu?.recipe,
    };
  });
}

function ingredientUsage(items: OrderItem[]) {
  const used: Record<string, number> = {};
  items.forEach((item) => {
    if (isConsignmentKey(item.menu)) return;
    Object.entries(item.recipe ?? {}).forEach(([id, qty]) => {
      used[id] = (used[id] || 0) + qty * item.qty;
    });
  });
  return used;
}

function consignmentUsage(items: OrderItem[]) {
  const used: Record<string, number> = {};
  items.forEach((item) => {
    if (!isConsignmentKey(item.menu)) return;
    const id = consignmentIdFromKey(item.menu);
    used[id] = (used[id] || 0) + item.qty;
  });
  return used;
}

function hasStock(inventory: InventoryItem[], consignments: ConsignmentItem[], items: OrderItem[]) {
  const ingredients = ingredientUsage(items);
  const consignmentQty = consignmentUsage(items);
  return Object.entries(ingredients).every(
    ([id, qty]) => (inventory.find((item) => item.id === id)?.qty ?? 0) >= qty,
  ) && Object.entries(consignmentQty).every(
    ([id, qty]) => (consignments.find((item) => item.id === id)?.qty ?? 0) >= qty,
  );
}

function consumeInventory(inventory: InventoryItem[], items: OrderItem[]) {
  const used = ingredientUsage(items);
  return inventory.map((item) => (
    used[item.id] ? { ...item, qty: item.qty - used[item.id] } : item
  ));
}

function restoreInventory(inventory: InventoryItem[], items: OrderItem[]) {
  const used = ingredientUsage(items);
  return inventory.map((item) => (
    used[item.id] ? { ...item, qty: item.qty + used[item.id] } : item
  ));
}

function consumeConsignments(consignments: ConsignmentItem[], items: OrderItem[]) {
  const used = consignmentUsage(items);
  return consignments.map((item) => (
    used[item.id] ? { ...item, qty: item.qty - used[item.id] } : item
  ));
}

function restoreConsignments(consignments: ConsignmentItem[], items: OrderItem[]) {
  const used = consignmentUsage(items);
  return consignments.map((item) => (
    used[item.id] ? { ...item, qty: item.qty + used[item.id] } : item
  ));
}

function allOrderItems(order: ActiveOrder) {
  return mergeItems(order.items, order.pendingItems ?? []);
}

export function submitOrder(
  state: WarungState,
  input: { tables: number[]; pax: number; items: OrderItem[]; note: string },
  createId: () => string,
  createdAt: string,
): WarungState {
  const submittedItems = snapshotItems(input.items, state.menus, state.consignments);
  if (!hasStock(state.inventory, state.consignments, submittedItems)) return state;
  const order: ActiveOrder = {
    id: createId(),
    tables: input.tables,
    pax: input.pax,
    items: submittedItems,
    note: input.note,
    cooked: false,
    createdAt,
  };
  return {
    ...state,
    activeOrders: [...state.activeOrders, order],
    kitchenOrders: [...state.kitchenOrders, order],
    inventory: consumeInventory(state.inventory, submittedItems),
    consignments: consumeConsignments(state.consignments, submittedItems),
  };
}

export function appendOrderItems(
  state: WarungState,
  orderId: string,
  items: OrderItem[],
  note: string,
  createId: () => string,
): WarungState {
  const order = state.activeOrders.find((entry) => entry.id === orderId);
  if (!order) return state;
  const submittedItems = snapshotItems(items, state.menus, state.consignments);
  if (!hasStock(state.inventory, state.consignments, submittedItems)) return state;

  if (!order.cooked && !order.pendingItems?.length) {
    const updated = {
      ...order,
      items: mergeItems(order.items, submittedItems),
      note: note || order.note,
      cooked: false,
    };
    return {
      ...state,
      activeOrders: state.activeOrders.map((entry) => entry.id === orderId ? updated : entry),
      kitchenOrders: [...state.kitchenOrders.filter((entry) => entry.id !== orderId), updated],
      inventory: consumeInventory(state.inventory, submittedItems),
      consignments: consumeConsignments(state.consignments, submittedItems),
    };
  }

  const existingAdditional = state.kitchenOrders.find(
    (entry) => entry.isAdditional && entry.parentOrderId === orderId,
  );
  const updated = {
    ...order,
    pendingItems: mergeItems(order.pendingItems || [], submittedItems),
    note: note || order.note,
    cooked: false,
  };
  const additionalTicket: ActiveOrder = existingAdditional
    ? {
      ...existingAdditional,
      items: mergeItems(existingAdditional.items, submittedItems),
      tables: order.tables,
      note: note || existingAdditional.note,
    }
    : {
      ...order,
      id: createId(),
      items: submittedItems,
      pendingItems: undefined,
      isAdditional: true,
      parentOrderId: orderId,
      cooked: false,
      note: note || order.note,
    };
  return {
    ...state,
    activeOrders: state.activeOrders.map((entry) => entry.id === orderId ? updated : entry),
    kitchenOrders: existingAdditional
      ? state.kitchenOrders.map((entry) => entry.id === existingAdditional.id ? additionalTicket : entry)
      : [...state.kitchenOrders, additionalTicket],
    inventory: consumeInventory(state.inventory, submittedItems),
    consignments: consumeConsignments(state.consignments, submittedItems),
  };
}

export function cancelActiveOrder(state: WarungState, orderId: string): WarungState {
  const order = state.activeOrders.find((entry) => entry.id === orderId);
  if (!order || order.cooked) return state;
  const items = allOrderItems(order);
  return {
    ...state,
    activeOrders: state.activeOrders.filter((entry) => entry.id !== orderId),
    kitchenOrders: state.kitchenOrders.filter(
      (entry) => entry.id !== orderId && entry.parentOrderId !== orderId,
    ),
    inventory: restoreInventory(state.inventory, items),
    consignments: restoreConsignments(state.consignments, items),
  };
}