import type { Metadata } from "next";
import { AdminEmpty, AdminHeading, LoadError } from "@/components/admin/bits";
import { InventoryTable, type InventoryRow } from "@/components/admin/inventory-table";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Inventory" };

export default async function AdminInventoryPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, status, is_coming_soon, track_inventory, stock_quantity, low_stock_threshold")
    .neq("status", "archived")
    .order("name")
    .limit(500);
  const products = (data ?? []) as InventoryRow[];

  return (
    <>
      <AdminHeading
        title="Inventory"
        description="Stock is counted in individual pieces; a set of 2 uses 2 pieces. Tracked stock is deducted when you confirm an order and returned if a confirmed order is cancelled. Products that are not tracked are always available."
      />
      {error ? (
        <LoadError message={error.message} />
      ) : products.length === 0 ? (
        <AdminEmpty title="No products yet" body="Products will appear here once they are created." />
      ) : (
        <InventoryTable products={products} />
      )}
    </>
  );
}
