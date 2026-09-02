import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { persistImageUri } from '@/utils/persistentImage';

export type MenuKey = string;
export type PaymentMethod = 'Tunai' | 'QRIS';
export interface MenuItem { id: string; name: string; price: number; recipe: Record<string, number>; category?: string; imageUri?: string }
export interface OrderItem {
  menu: MenuKey;
  qty: number;
  note?: string;
  /** Immutable catalog values captured when the item is submitted. */
  displayName?: string;
  unitPrice?: number;
  recipe?: Record<string, number>;
  /** Per-piece amount owed to a consignor. */
  consignmentUnitCost?: number;
}
export interface ActiveOrder {
  id: string;
  tables: number[];
  pax: number;
  items: OrderItem[];
  note: string;
  createdAt: string;
  cooked?: boolean;
  pendingItems?: OrderItem[];
  isAdditional?: boolean;
  parentOrderId?: string;
}
export interface Sale {
  id: string;
  amount: number;
  method: PaymentMethod;
  items: OrderItem[];
  date: string;
  tables?: number[];
  paidAt?: string;
}
export interface InventoryItem { id: string; name: string; unit: string; qty: number; safe: number }
export interface ConsignmentItem {
  id: string;
  name: string;
  imageUri?: string;
  /** Harga yang dibayarkan ke penitip untuk satu plastik. */
  cost: number;
  /** Harga jual untuk satu biji. */
  sellPrice: number;
  /** Jumlah biji dalam satu plastik. */
  packSize: number;
  /** Stok disimpan dalam satuan biji. */
  qty: number;
}
export interface Expense { id: string; title: string; amount: number; date: string }
export interface SavingsRule {
  id: string;
  name: string;
  inventoryId: string;
  amountPerItem: number;
  savedAmount: number;
  savedQty: number;
}
export interface SavingsEntry {
  id: string;
  name: string;
  inventoryId: string;
  consignmentId?: string;
  qty: number;
  amount: number;
  date: string;
}

const padDatePart = (value: number) => String(value).padStart(2, '0');

export const localDate = (date: Date = new Date()) => {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
};

export type ReportPeriod = 'Hari ini' | 'Minggu ini' | 'Bulan ini';

export function isDateInReportPeriod(date: string, period: ReportPeriod, now: Date = new Date()) {
  const today = localDate(now);
  if (period === 'Hari ini') return date === today;
  if (period === 'Bulan ini') return date.slice(0, 7) === today.slice(0, 7);

  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  const startDate = localDate(weekStart);
  return date >= startDate && date <= today;
}
interface State {
  menus: MenuItem[]; activeOrders: ActiveOrder[]; kitchenOrders: ActiveOrder[]; inventory: InventoryItem[]; consignments: ConsignmentItem[]; expenses: Expense[]; sales: Sale[]; savingsRules: SavingsRule[]; savingsEntries: SavingsEntry[]; qrisImageUri?: string;
}
interface ContextValue extends State {
  hydrated: boolean;
  addMenu: (name: string, price: number, recipe?: Record<string, number>, category?: string, imageUri?: string) => void;
  updateMenu: (id: string, name: string, price: number, recipe?: Record<string, number>, category?: string, imageUri?: string) => void;
  deleteMenu: (id: string) => void;
  addInventoryItem: (name: string, unit: string, qty: number, safe: number) => void;
  updateInventoryItem: (id: string, name: string, unit: string, qty: number, safe: number) => void;
  deleteInventoryItem: (id: string) => void;
  addConsignment: (name: string, cost: number, sellPrice: number, qty: number, packSize?: number, imageUri?: string) => void;
  updateConsignment: (id: string, name: string, cost: number, sellPrice: number, qty: number, packSize?: number, imageUri?: string) => void;
  deleteConsignment: (id: string) => void;
  addConsignmentStock: (id: string, qty: number) => void;
  removeConsignmentStock: (id: string, qty: number) => void;
  consumeConsignmentItems: (items: OrderItem[]) => void;
  restoreConsignmentItems: (items: OrderItem[]) => void;
  addOrder: (tables: number[], pax: number, items: OrderItem[], note: string) => void;
  updateOrderTables: (id: string, tables: number[]) => void;
  addItems: (id: string, items: OrderItem[], note: string) => void;
  completeKitchen: (id: string) => void;
  mergeOrders: (targetId: string, sourceId: string) => void;
  payOrder: (id: string, amount: number, method: PaymentMethod) => void;
  consumeItems: (items: OrderItem[]) => void;
  restoreItems: (items: OrderItem[]) => void;
  addStock: (id: string, qty: number) => void;
  removeStock: (id: string, qty: number) => void;
  addExpense: (title: string, amount: number) => void;
  addSavingsRule: (name: string, inventoryId: string, amountPerItem: number) => void;
  addManualSaving: (name: string, amount: number) => void;
  useSavings: (sourceId: string, sourceType: 'rule' | 'manual' | 'consignment', amount: number) => void;
  deleteSavingsRule: (id: string) => void;
  setQrisImageUri: (uri: string) => void;
  cancelOrder: (id: string) => void;
}
const WarungContext = createContext<ContextValue | null>(null);
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const defaultState: State = {
  menus: [],
  activeOrders: [],
  kitchenOrders: [],
  inventory: [], consignments: [], expenses: [], sales: [], savingsRules: [], savingsEntries: [], qrisImageUri: undefined,
};
export function WarungProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('warung-state-v2')
      .then(async raw => {
        if (!mounted) return;
        if (raw) {
          try {
            const saved = JSON.parse(raw) as Partial<State>;
            const savedKitchenOrders = Array.isArray(saved.kitchenOrders) ? saved.kitchenOrders : [];
            const savedActiveOrders = Array.isArray(saved.activeOrders) ? saved.activeOrders : [];
            const normalizedActiveOrders = savedActiveOrders.map(order => ({
              ...order,
              cooked: typeof order.cooked === 'boolean'
                ? order.cooked
                : !savedKitchenOrders.some(kitchenOrder => kitchenOrder.id === order.id),
            }));
            const menus = Array.isArray(saved.menus)
              ? await Promise.all(saved.menus.map(async (menu) => ({
                ...menu,
                imageUri: await persistImageUri(menu.imageUri),
              })))
              : [];
            const consignments = Array.isArray(saved.consignments)
              ? await Promise.all(saved.consignments.map(async (item) => ({
                ...item,
                imageUri: await persistImageUri(item.imageUri),
              })))
              : [];
            const qrisImageUri = await persistImageUri(saved.qrisImageUri);
            setState({
              ...defaultState,
              ...saved,
              menus,
               activeOrders: normalizedActiveOrders,
               kitchenOrders: savedKitchenOrders,
              inventory: Array.isArray(saved.inventory) ? saved.inventory : [],
              consignments: consignments.map((item) => ({ ...item, packSize: Number(item.packSize) > 0 ? Number(item.packSize) : 1 })),
              expenses: Array.isArray(saved.expenses) ? saved.expenses : [],
              sales: Array.isArray(saved.sales) ? saved.sales : [],
              savingsRules: Array.isArray(saved.savingsRules) ? saved.savingsRules : [],
              savingsEntries: Array.isArray(saved.savingsEntries) ? saved.savingsEntries : [],
              qrisImageUri,
            });
          } catch {
            setState(defaultState);
          }
        }
      })
      .catch(() => {
        if (mounted) setState(defaultState);
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem('warung-state-v2', JSON.stringify(state));
  }, [hydrated, state]);
  const value = useMemo<ContextValue>(() => ({
    ...state,
    hydrated,
    addMenu: (name, price, recipe = {}, category = 'Lainnya', imageUri) => setState(s => ({ ...s, menus: [...s.menus, { id: makeId(), name, price, recipe, category, imageUri }] })),
    updateMenu: (id, name, price, recipe = {}, category = 'Lainnya', imageUri) => setState(s => ({ ...s, menus: s.menus.map(item => item.id === id ? { ...item, name, price, recipe, category, imageUri } : item) })),
    deleteMenu: id => setState(s => ({ ...s, menus: s.menus.filter(item => item.id !== id) })),
    addInventoryItem: (name, unit, qty, safe) => setState(s => ({ ...s, inventory: [...s.inventory, { id: makeId(), name, unit, qty, safe }] })),
     updateInventoryItem: (id, name, unit, qty, safe) => setState(s => ({ ...s, inventory: s.inventory.map(item => item.id === id ? { ...item, name, unit, qty, safe } : item) })),
     deleteInventoryItem: id => setState(s => ({ ...s, inventory: s.inventory.filter(item => item.id !== id) })),
      addConsignment: (name, cost, sellPrice, qty, packSize = 10, imageUri) => setState(s => ({ ...s, consignments: [...s.consignments, { id: makeId(), name, cost, sellPrice, packSize, qty, imageUri }] })),
      updateConsignment: (id, name, cost, sellPrice, qty, packSize = 10, imageUri) => setState(s => ({ ...s, consignments: s.consignments.map(item => item.id === id ? { ...item, name, cost, sellPrice, packSize, qty, imageUri } : item) })),
     deleteConsignment: id => setState(s => ({ ...s, consignments: s.consignments.filter(item => item.id !== id) })),
     addConsignmentStock: (id, qty) => setState(s => ({ ...s, consignments: s.consignments.map(item => item.id === id ? { ...item, qty: item.qty + qty } : item) })),
     removeConsignmentStock: (id, qty) => setState(s => ({ ...s, consignments: s.consignments.map(item => item.id === id ? { ...item, qty: Math.max(0, item.qty - qty) } : item) })),
     consumeConsignmentItems: items => setState(s => ({
       ...s,
       consignments: s.consignments.map(item => {
         const key = consignmentKey(item.id);
         const used = items.filter(entry => entry.menu === key).reduce((sum, entry) => sum + entry.qty, 0);
         return used ? { ...item, qty: Math.max(0, item.qty - used) } : item;
       }),
     })),
     restoreConsignmentItems: items => setState(s => ({
       ...s,
       consignments: s.consignments.map(item => {
         const key = consignmentKey(item.id);
         const restored = items.filter(entry => entry.menu === key).reduce((sum, entry) => sum + entry.qty, 0);
         return restored ? { ...item, qty: item.qty + restored } : item;
       }),
     })),
     addOrder: (tables, pax, items, note) => setState(s => {
       const submittedItems = snapshotOrderItems(items, s.menus, s.consignments);
       if (!hasStockForOrder(s.inventory, s.consignments, submittedItems)) return s;
       const order = { id: makeId(), tables, pax, items: submittedItems, note, cooked: false, createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) };
       return {
         ...s,
         activeOrders: [...s.activeOrders, order],
         kitchenOrders: [...s.kitchenOrders, order],
         inventory: consume(s.inventory, s.menus, submittedItems),
         consignments: consumeConsignmentStock(s.consignments, submittedItems),
       };
     }),
     updateOrderTables: (id, tables) => setState(s => {
       const update = (order: ActiveOrder) => order.id === id || order.parentOrderId === id ? { ...order, tables } : order;
       return { ...s, activeOrders: s.activeOrders.map(update), kitchenOrders: s.kitchenOrders.map(update) };
     }),
     addItems: (id, items, note) => setState(s => {
      const order = s.activeOrders.find(o => o.id === id);
      if (!order) return s;
       const submittedItems = snapshotOrderItems(items, s.menus, s.consignments);
       if (!hasStockForOrder(s.inventory, s.consignments, submittedItems)) return s;
       if (!order.cooked && !order.pendingItems?.length) {
          const updated = { ...order, items: mergeOrderItems(order.items, submittedItems), note: note || order.note, cooked: false };
          return {
            ...s, activeOrders: s.activeOrders.map(o => o.id === id ? updated : o), kitchenOrders: [...s.kitchenOrders.filter(o => o.id !== id), updated],
            inventory: consume(s.inventory, s.menus, submittedItems), consignments: consumeConsignmentStock(s.consignments, submittedItems),
          };
       }

       const existingAdditional = s.kitchenOrders.find((kitchenOrder) => kitchenOrder.isAdditional && kitchenOrder.parentOrderId === id);
       const updated = {
         ...order,
          pendingItems: mergeOrderItems(order.pendingItems || [], submittedItems),
         note: note || order.note,
         cooked: false,
       };
       const additionalTicket: ActiveOrder = existingAdditional
         ? {
           ...existingAdditional,
            items: mergeOrderItems(existingAdditional.items, submittedItems),
           tables: order.tables,
           note: note || existingAdditional.note,
         }
         : {
           ...order,
           id: makeId(),
            items: submittedItems,
           pendingItems: undefined,
           isAdditional: true,
           parentOrderId: id,
           cooked: false,
           note: note || order.note,
         };
       return {
         ...s,
         activeOrders: s.activeOrders.map(o => o.id === id ? updated : o),
         kitchenOrders: existingAdditional
           ? s.kitchenOrders.map(o => o.id === existingAdditional.id ? additionalTicket : o)
           : [...s.kitchenOrders, additionalTicket],
          inventory: consume(s.inventory, s.menus, submittedItems),
          consignments: consumeConsignmentStock(s.consignments, submittedItems),
       };
    }),
     completeKitchen: id => setState(s => {
       const kitchenOrder = s.kitchenOrders.find((order) => order.id === id);
       if (!kitchenOrder) return s;

       if (kitchenOrder.isAdditional && kitchenOrder.parentOrderId) {
         const parent = s.activeOrders.find((order) => order.id === kitchenOrder.parentOrderId);
         if (!parent) return { ...s, kitchenOrders: s.kitchenOrders.filter((order) => order.id !== id) };
         const remainingAdditional = s.kitchenOrders.filter(
           (order) => order.id !== id && order.isAdditional && order.parentOrderId === parent.id,
         );
         const remainingItems = remainingAdditional.flatMap((order) => order.items);
         const updatedParent: ActiveOrder = {
           ...parent,
           items: mergeOrderItems(parent.items, kitchenOrder.items),
           pendingItems: remainingItems.length ? mergeOrderItems([], remainingItems) : undefined,
           cooked: remainingAdditional.length === 0,
         };
         return {
           ...s,
           activeOrders: s.activeOrders.map((order) => order.id === parent.id ? updatedParent : order),
           kitchenOrders: s.kitchenOrders.filter((order) => order.id !== id),
         };
       }

       return {
         ...s,
         activeOrders: s.activeOrders.map(o => o.id === id ? { ...o, cooked: true } : o),
         kitchenOrders: s.kitchenOrders.filter(o => o.id !== id),
       };
     }),
    mergeOrders: (targetId, sourceId) => setState(s => {
      const target = s.activeOrders.find(o => o.id === targetId);
      const source = s.activeOrders.find(o => o.id === sourceId);
      if (!target || !source || target.id === source.id) return s;
       const mergedItems = mergeOrderItems(target.items, source.items);
       const mergedPendingItems = mergeOrderItems(target.pendingItems || [], source.pendingItems || []);
      const merged = {
        ...target,
        tables: [...new Set([...target.tables, ...source.tables])],
        pax: target.pax + source.pax,
        items: mergedItems,
         pendingItems: mergedPendingItems.length ? mergedPendingItems : undefined,
        note: [target.note, source.note].filter(Boolean).join(' · '),
         cooked: Boolean(target.cooked && source.cooked && !mergedPendingItems.length),
      };
       const relatedKitchenOrders = s.kitchenOrders.filter(
         (order) => order.id === targetId
           || order.id === sourceId
           || order.parentOrderId === targetId
           || order.parentOrderId === sourceId,
       );
       const remainingKitchenOrders = s.kitchenOrders.filter((order) => !relatedKitchenOrders.includes(order));
       const mainKitchenOrder = relatedKitchenOrders.find((order) => !order.isAdditional);
       const mergedKitchenOrder = merged.cooked
         ? null
         : mainKitchenOrder
           ? { ...merged, id: targetId, isAdditional: undefined, parentOrderId: undefined }
           : mergedPendingItems.length
             ? { ...merged, id: makeId(), items: mergedPendingItems, pendingItems: undefined, isAdditional: true, parentOrderId: targetId }
             : { ...merged, id: targetId };
      return {
        ...s,
        activeOrders: s.activeOrders.filter(o => o.id !== sourceId).map(o => o.id === targetId ? merged : o),
         kitchenOrders: mergedKitchenOrder ? [...remainingKitchenOrders, mergedKitchenOrder] : remainingKitchenOrders,
      };
    }),
      payOrder: (id, amount, method) => setState(s => {
        const order = s.activeOrders.find(o => o.id === id);
        return order?.cooked ? {
          ...s,
          activeOrders: s.activeOrders.filter(o => o.id !== id),
          kitchenOrders: s.kitchenOrders.filter(o => o.id !== id),
          sales: [
            ...s.sales,
            {
              id: makeId(),
              amount,
              method,
               items: getOrderItems(order),
              tables: order.tables,
              date: localDate(),
              paidAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            },
          ],
          savingsRules: s.savingsRules.map((rule) => {
              const savedQty = getOrderItems(order).reduce((total, item) => total + (item.recipe?.[rule.inventoryId] ?? s.menus.find((menu) => menu.id === item.menu)?.recipe[rule.inventoryId] ?? 0) * item.qty, 0);
            return savedQty
              ? { ...rule, savedQty: (rule.savedQty || 0) + savedQty, savedAmount: rule.savedAmount + savedQty * rule.amountPerItem }
              : rule;
          }),
          savingsEntries: [
            ...s.savingsEntries,
            ...s.savingsRules.flatMap((rule) => {
               const qty = getOrderItems(order).reduce((total, item) => total + (item.recipe?.[rule.inventoryId] ?? s.menus.find((menu) => menu.id === item.menu)?.recipe[rule.inventoryId] ?? 0) * item.qty, 0);
              return qty ? [{ id: makeId(), name: rule.name, inventoryId: rule.inventoryId, qty, amount: qty * rule.amountPerItem, date: localDate() }] : [];
            }),
              ...getOrderItems(order).flatMap((item) => {
               if (!isConsignmentKey(item.menu)) return [];
                const consignment = s.consignments.find((entry) => entry.id === consignmentIdFromKey(item.menu));
                const unitCost = item.consignmentUnitCost ?? (consignment && consignment.packSize > 0 ? consignment.cost / consignment.packSize : undefined);
                if (unitCost === undefined) return [];
               return [{
                 id: makeId(),
                  name: `Bayar penitip · ${item.displayName ?? consignment?.name ?? 'Titipan'}`,
                 inventoryId: '',
                  consignmentId: consignment?.id,
                 qty: item.qty,
                  amount: item.qty * unitCost,
                 date: localDate(),
               }];
             }),
          ],
        } : s;
      }),
    cancelOrder: id => setState(s => {
      const order = s.activeOrders.find(o => o.id === id);
       if (!order || order.cooked) return s;
       return {
         ...s,
         activeOrders: s.activeOrders.filter(o => o.id !== id),
          kitchenOrders: s.kitchenOrders.filter(o => o.id !== id && o.parentOrderId !== id),
          inventory: restore(s.inventory, s.menus, getOrderItems(order)),
          consignments: restoreConsignmentStock(s.consignments, getOrderItems(order)),
       };
    }),
    consumeItems: items => setState(s => ({ ...s, inventory: consume(s.inventory, s.menus, items) })),
    restoreItems: items => setState(s => ({ ...s, inventory: restore(s.inventory, s.menus, items) })),
    addStock: (id, qty) => setState(s => ({ ...s, inventory: s.inventory.map(i => i.id === id ? { ...i, qty: i.qty + qty } : i) })),
    removeStock: (id, qty) => setState(s => ({ ...s, inventory: s.inventory.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty - qty) } : i) })),
      addExpense: (title, amount) => setState(s => ({ ...s, expenses: [...s.expenses, { id: makeId(), title, amount, date: localDate() }] })),
     addSavingsRule: (name, inventoryId, amountPerItem) => setState(s => {
       if (s.savingsRules.some((rule) => rule.inventoryId === inventoryId)) return s;
       return { ...s, savingsRules: [...s.savingsRules, { id: makeId(), name, inventoryId, amountPerItem, savedAmount: 0, savedQty: 0 }] };
     }),
      addManualSaving: (name, amount) => setState(s => ({
        ...s,
        savingsEntries: [...s.savingsEntries, { id: makeId(), name, inventoryId: '', qty: 0, amount, date: localDate() }],
      })),
       useSavings: (sourceId, sourceType, amount) => setState(s => {
         if (!Number.isFinite(amount) || amount <= 0) return s;
         if (sourceType === 'rule') {
           const rule = s.savingsRules.find((entry) => entry.id === sourceId);
           if (!rule || rule.savedAmount < amount) return s;
           return {
             ...s,
             savingsRules: s.savingsRules.map((entry) => entry.id === sourceId
               ? { ...entry, savedAmount: Math.max(0, entry.savedAmount - amount), savedQty: Math.max(0, entry.savedQty - amount / entry.amountPerItem) }
               : entry),
             expenses: [...s.expenses, { id: makeId(), title: `Belanja dari sisihan · ${rule.name}`, amount, date: localDate() }],
           };
         }
         const matchingEntries = s.savingsEntries.filter((entry) => sourceType === 'manual'
           ? entry.name === sourceId && !entry.inventoryId && !entry.consignmentId
           : entry.consignmentId === sourceId);
         const available = matchingEntries.reduce((sum, entry) => sum + entry.amount, 0);
         if (!matchingEntries.length || available < amount) return s;
         let remaining = amount;
         const savingsEntries = s.savingsEntries.map((entry) => {
           const matches = sourceType === 'manual'
             ? entry.name === sourceId && !entry.inventoryId && !entry.consignmentId
             : entry.consignmentId === sourceId;
           if (!matches || remaining <= 0) return entry;
           const used = Math.min(entry.amount, remaining);
           remaining -= used;
           return { ...entry, amount: entry.amount - used };
         }).filter((entry) => entry.amount > 0);
         const displayName = matchingEntries[0].name;
         return {
           ...s,
           savingsEntries,
           expenses: [...s.expenses, { id: makeId(), title: `Belanja dari sisihan · ${displayName}`, amount, date: localDate() }],
         };
       }),
     deleteSavingsRule: id => setState(s => ({ ...s, savingsRules: s.savingsRules.filter((rule) => rule.id !== id) })),
    setQrisImageUri: qrisImageUri => setState(s => ({ ...s, qrisImageUri })),
  }), [hydrated, state]);
  return <WarungContext.Provider value={value}>{children}</WarungContext.Provider>;
}
function consume(items: InventoryItem[], menus: MenuItem[], orders: OrderItem[]) {
  const used: Record<string, number> = {};
  orders.forEach(o => Object.entries(o.recipe ?? menus.find(item => item.id === o.menu)?.recipe ?? {}).forEach(([id, qty]) => { used[id] = (used[id] || 0) + qty * o.qty; }));
  return items.map(item => ({ ...item, qty: Math.max(0, item.qty - (used[item.id] || 0)) }));
}
function restore(items: InventoryItem[], menus: MenuItem[], orders: OrderItem[]) {
  const used: Record<string, number> = {};
  orders.forEach(o => Object.entries(o.recipe ?? menus.find(item => item.id === o.menu)?.recipe ?? {}).forEach(([id, qty]) => { used[id] = (used[id] || 0) + qty * o.qty; }));
  return items.map(item => ({ ...item, qty: item.qty + (used[item.id] || 0) }));
}
export function useWarung() { const context = useContext(WarungContext); if (!context) throw new Error('useWarung harus dipakai di dalam WarungProvider'); return context; }
export const consignmentKey = (id: string) => `consignment:${id}`;
export const isConsignmentKey = (key: string) => key.startsWith('consignment:');
export const consignmentIdFromKey = (key: string) => key.replace(/^consignment:/, '');
export function getOrderItems(order: ActiveOrder) {
  return mergeOrderItems(order.items, order.pendingItems || []);
}
function restoreConsignmentStock(items: ConsignmentItem[], orders: OrderItem[]) {
  const restored: Record<string, number> = {};
  orders.forEach(order => {
    if (!isConsignmentKey(order.menu)) return;
    const id = consignmentIdFromKey(order.menu);
    restored[id] = (restored[id] || 0) + order.qty;
  });
  return items.map(item => restored[item.id] ? { ...item, qty: item.qty + restored[item.id] } : item);
}
export function orderTotal(order: ActiveOrder, menus: MenuItem[], consignments: ConsignmentItem[] = []) {
  return getOrderItems(order).reduce((sum, item) => {
    const menuPrice = menus.find(menuItem => menuItem.id === item.menu)?.price;
    const consignmentPrice = isConsignmentKey(item.menu)
      ? consignments.find(consignment => consignment.id === consignmentIdFromKey(item.menu))?.sellPrice
      : undefined;
    return sum + (item.unitPrice ?? menuPrice ?? consignmentPrice ?? 0) * item.qty;
  }, 0);
}
function mergeOrderItems(...groups: OrderItem[][]) {
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
function snapshotOrderItems(items: OrderItem[], menus: MenuItem[], consignments: ConsignmentItem[]) {
  return items.map((item) => {
    if (isConsignmentKey(item.menu)) {
      const consignment = consignments.find((entry) => entry.id === consignmentIdFromKey(item.menu));
      return {
        ...item,
        displayName: item.displayName ?? consignment?.name,
        unitPrice: item.unitPrice ?? consignment?.sellPrice,
        consignmentUnitCost: item.consignmentUnitCost ?? (consignment && consignment.packSize > 0 ? consignment.cost / consignment.packSize : undefined),
      };
    }
    const menu = menus.find((entry) => entry.id === item.menu);
    return { ...item, displayName: item.displayName ?? menu?.name, unitPrice: item.unitPrice ?? menu?.price, recipe: item.recipe ?? menu?.recipe };
  });
}
function hasStockForOrder(inventory: InventoryItem[], consignments: ConsignmentItem[], items: OrderItem[]) {
  const ingredients: Record<string, number> = {};
  const consignmentQty: Record<string, number> = {};
  items.forEach((item) => {
    if (isConsignmentKey(item.menu)) {
      const id = consignmentIdFromKey(item.menu);
      consignmentQty[id] = (consignmentQty[id] || 0) + item.qty;
    } else {
      Object.entries(item.recipe ?? {}).forEach(([id, qty]) => { ingredients[id] = (ingredients[id] || 0) + qty * item.qty; });
    }
  });
  return Object.entries(ingredients).every(([id, qty]) => (inventory.find((item) => item.id === id)?.qty ?? 0) >= qty)
    && Object.entries(consignmentQty).every(([id, qty]) => (consignments.find((item) => item.id === id)?.qty ?? 0) >= qty);
}
function consumeConsignmentStock(items: ConsignmentItem[], orders: OrderItem[]) {
  const used: Record<string, number> = {};
  orders.forEach((order) => {
    if (!isConsignmentKey(order.menu)) return;
    const id = consignmentIdFromKey(order.menu);
    used[id] = (used[id] || 0) + order.qty;
  });
  return items.map((item) => used[item.id] ? { ...item, qty: Math.max(0, item.qty - used[item.id]) } : item);
}
export function formatRp(value: number) { return `Rp ${value.toLocaleString('id-ID')}`; }