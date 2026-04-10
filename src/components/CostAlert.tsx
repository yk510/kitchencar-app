'use client'

interface Props {
  count: number
  names: string[]
}

export default function CostAlert({ count, names }: Props) {
  const preview = names.slice(0, 3).join('、')
  const suffix  = names.length > 3 ? ` ほか${names.length - 3}件` : ''

  return (
    <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
      <span className="text-amber-500 text-xl mt-0.5">⚠</span>
      <div className="flex-1">
        <p className="font-semibold text-amber-800">
          原価未登録の商品が {count} 件あります
        </p>
        <p className="text-sm text-amber-700 mt-0.5">
          {preview}{suffix}
        </p>
        <p className="text-sm text-amber-600 mt-1">
          正確な利益計算のため、原価を登録してください。
        </p>
      </div>
      <a href="/products/master"
        className="text-sm bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600 whitespace-nowrap">
        原価を登録する
      </a>
    </div>
  )
}
