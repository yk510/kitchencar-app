import type { MobileOrderProductRow } from '@/types/api-payloads'

type Props = {
  products: MobileOrderProductRow[]
  linkedProductIds: string[]
  onToggleProduct: (productId: string) => void
}

export default function VendorMobileOrderOptionGroupProductsSection({
  products,
  linkedProductIds,
  onToggleProduct,
}: Props) {
  return (
    <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
      <h3 className="text-base font-semibold text-gray-800">対象商品</h3>
      <p className="mt-1 text-sm text-gray-500">
        このオプションを表示したい商品にチェックを入れてください。
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {products.length === 0 ? (
          <p className="text-sm text-gray-500">先に商品を追加すると、ここで紐付けできます。</p>
        ) : (
          products.map((product) => (
            <label
              key={product.id}
              className="rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-3 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={linkedProductIds.includes(product.id)}
                onChange={() => onToggleProduct(product.id)}
                className="mr-2"
              />
              {product.name}
            </label>
          ))
        )}
      </div>
    </div>
  )
}
