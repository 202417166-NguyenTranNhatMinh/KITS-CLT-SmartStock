// Kiểu dữ liệu đã map từ DB (snake_case) sang camelCase. Không chứa password_hash.

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  categoryId: number;
  categoryName: string;
  unit: string;
  price: number;
  quantityInStock: number;
  minStock: number;
  isActive: boolean;
}
