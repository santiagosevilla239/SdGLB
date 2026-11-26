import { create } from 'zustand';

export interface CartItem {
  id: string;
  name: string;
  quantity: number;
  type: 'tub' | 'supply';
}

interface CartStore {
  items: CartItem[];
  addItem: (item: { id: string; name: string; type: 'tub' | 'supply' }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (newItem) => set((state) => {
    const existing = state.items.find(item => item.id === newItem.id);
    if (existing) {
      return {
        items: state.items.map(item => 
          item.id === newItem.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      };
    }
    return { items: [...state.items, { id: newItem.id, name: newItem.name, quantity: 1, type: newItem.type }] };
  }),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(item => item.id !== id)
  })),
  updateQuantity: (id, quantity) => set((state) => {
    if (quantity <= 0) {
      return { items: state.items.filter(item => item.id !== id) };
    }
    return {
      items: state.items.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    };
  }),
  clearCart: () => set({ items: [] }),
  getTotalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
}));
