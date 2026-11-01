import axios from "axios";
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15000,
  headers: { "X-StockFlow": "1" },
});
export function explain(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401)
      return "Your session has ended. Please sign in again.";
    if (error.response?.status === 403)
      return "Your role does not have access to this action. Ask your administrator for help.";
    if (error.response?.status === 429)
      return "Too many sign-in attempts. Please wait a minute and try again.";
    const body = error.response?.data;
    if (body?.errors) return Object.values(body.errors).flat().join(" ");
    return (
      body?.detail ||
      "We could not reach StockFlow. Check your connection and try again."
    );
  }
  return "Something went wrong. Please try again.";
}
export type Role = "Admin" | "Sales" | "Inventory";
export type Employee = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  active?: boolean;
};
export type Contact = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
};
export type Product = {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  reorderLevel: number;
  categoryId: number;
  supplierId: number;
  categoryName: string;
  supplierName: string;
  active: boolean;
};
export type Line = {
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
};
export type Order = {
  id: number;
  customerId: number;
  customerName: string;
  createdAt: string;
  status: "Draft" | "Confirmed" | "Canceled";
  total: number;
  items: Line[];
};
export type Movement = {
  id: number;
  productId: number;
  productName: string;
  delta: number;
  reason: string;
  actorName: string;
  createdAt: string;
  salesOrderId: number | null;
};
export type Data = {
  products: Product[];
  categories: Contact[];
  suppliers: Contact[];
  customers: Contact[];
  orders: Order[];
  movements: Movement[];
  users: Employee[];
};
export const empty: Data = {
  products: [],
  categories: [],
  suppliers: [],
  customers: [],
  orders: [],
  movements: [],
  users: [],
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    n,
  );
export const date = (s: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
