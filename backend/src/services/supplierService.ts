import { AppError } from "../common/errors";
import type { SupplierRequest } from "../contracts/suppliers/supplier.contract";
import * as supplierRepo from "../repo/supplierRepo";
import type { Supplier } from "../types/models";

export function listSuppliers(): Promise<Supplier[]> {
  return supplierRepo.findAll();
}

export function createSupplier(input: SupplierRequest): Promise<Supplier> {
  return supplierRepo.create(input);
}

export async function updateSupplier(id: number, input: SupplierRequest): Promise<Supplier> {
  const supplier = await supplierRepo.update(id, input);
  if (!supplier) throw AppError.notFound("Không tìm thấy nhà cung cấp");
  return supplier;
}
