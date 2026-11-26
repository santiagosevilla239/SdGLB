export type RoleEnum = 'admin' | 'branch' | 'user' | 'empleado';

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  is_central: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  branch_id: string | null;
  updated_at: string | null;
  role: RoleEnum;
}

export interface Flavor {
  id: string;
  name: string;
  description: string | null;
  price_per_kilo: number;
  is_active: boolean;
}

export type OrderStatus = 'pendiente' | 'contraoferta' | 'confirmado' | 'despachado' | 'entregado' | 'rechazado' | 'cancelado';

export interface Order {
  id: string;
  branch_id: string;
  status: OrderStatus;
  total_price: number;
  delivery_date: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  flavor_id: string;
  quantity: number;
}

export type TubStatus = 'in_stock' | 'in_transit' | 'consumed';

export interface Tub {
  id: string;
  flavor_id: string;
  branch_id: string | null;
  gross_weight: number;
  net_weight: number;
  total_price: number;
  internal_code: string | null;
  status: TubStatus;
  order_id: string | null;
  created_at: string;
}

// Interfaces extendidas para UI y consultas
export interface CatalogFlavor {
  id: string;
  name: string;
  price_per_kilo: number;
  avgWeight: number;
}

export interface FlavorWithStock {
  id: string;
  name: string;
  stock: number;
  totalWeight: string;
  avgWeight?: string;
  statusType: 'Disponible' | 'Limitado' | 'Sin stock';
  tubs?: { id: string; internalCode: string; weight: number }[];
}

export interface OrderWithDetails {
  id: string;
  originalId?: string;
  branchName?: string;
  items: number;
  status: OrderStatus;
  createdAt: string;
  estimatedPrice?: number;
  totalPrice?: number;
  adminNotes?: string;
  branchNotes?: string;
  canConfirm?: boolean;
  details?: { id?: string; flavorId?: string; name: string; quantity: number; approvedQuantity?: number; factoryStock?: number; assignedTubs?: { internalCode: string; weight: number; price: number }[] }[];
  supplies?: { id?: string; supplyId?: string; name: string; pricePerUnit: number; quantity: number; approvedQuantity?: number; }[];
}

export type PaymentMethod = 'transferencia' | 'efectivo' | 'cheque' | 'otro';
export type PaymentStatus = 'aprobado' | 'pendiente' | 'rechazado';

export interface Payment {
  id: string;
  branch_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  status: PaymentStatus;
  created_by?: string | null;
  created_at: string;
  branches?: { name: string };
}

export interface AccountMovement {
  id: string;
  date: string;
  type: 'pedido' | 'pago';
  displayId: string;
  description: string;
  debit: number;   // Pedido aumenta la deuda
  credit: number;  // Pago reduce la deuda
  balance: number; // Saldo resultante
  paymentMethod?: PaymentMethod | null;
  referenceNumber?: string | null;
  status?: string;
  notes?: string | null;
}

export interface BranchAccountSummary {
  branchId: string;
  branchName: string;
  totalOrdersAmount: number;
  totalPaymentsAmount: number;
  currentBalance: number;
  movementsCount: number;
}

