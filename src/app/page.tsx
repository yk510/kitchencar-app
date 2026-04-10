import { supabase } from '@/lib/supabase'
import CostAlert from '@/components/CostAlert'

async function getDashboardData() {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  // 今日の売上
  const { data: todayTxns } = await (supabase as any)
    .from('transactions')
    .select('total_amount')
    .eq('txn_date', today)
    .eq('is_return', false)

  // 今月の売上
  const { data: monthTxns } = await (supabase as any)
    .from('transactions')
    .select('total_amount')
    .gte('txn_date', monthStart)
    .lte('txn_date', today)
    .eq('is_return', false)

  // 今月の商品別売上
  const { data: monthProducts } = await (supabase as any)
    .from('product_sales')
    .select('product_name, subtotal, quantity')
    .gte('txn_date', monthStart)
    .lte('txn_date', today)

  // 原価未登録
  const { data: unregistered } = await (supabase as any)
    .from('product_master')
    .select('product_name')
    .is('cost_amount', null)
    .is('cost_rate', null)

  // 売上計算
  const todayList = (todayTxns ?? []) as any[]
  const monthList = (monthTxns ?? []) as any[]

  const todaySales = todayList.reduce((s, t) => s + t.total_amount, 0)
  const monthSales = monthList.reduce((s, t) => s + t.total_amount, 0)

  // 商品別集計
  const productMap = new Map<string, number>()
  for (const p of ((monthProducts ?? []) as any[])) {
    productMap.set(p.product_name, (productMap.get(p.product_name) ?? 0) + p.subtotal)
  }

  const top3 = Array.from(productMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return {
    todaySales,
    monthSales,
    top3,
    unregisteredCount: (unregistered ?? []).length,
    unregisteredNames: ((unregistered ?? []) as any[]).map((u: any) => u.product_name),
  }
}

function fmtYen(n: number) {
  return n.toLocaleString('ja-JP') + ' 円'
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード</h1>

      {data.unregisteredCount > 0 && (
        <CostAlert count={data.unregisteredCount} names={data.unregisteredNames} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">本日の売上</p>
          <p className="text-3xl font-bold text-blue-700">{fmtYen(data.todaySales)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">今月の売上</p>
          <p className="text-3xl font-bold text-blue-700">{fmtYen(data.monthSales)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">今月の売上TOP3商品</h2>
        {data.top3.length === 0 ? (
          <p className="text-gray-400 text-sm">データがありません。CSVをアップロードしてください。</p>
        ) : (
          <ol className="space-y-3">
            {data.top3.map(([name, amount], i) => (
              <li key={name} className="flex items-center gap-4">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white
                  ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : 'bg-amber-600'}`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-gray-800">{name}</span>
                <span className="font-semibold text-gray-700">{fmtYen(amount)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/upload',              label: 'CSVアップロード',  color: 'bg-blue-50  border-blue-200  text-blue-700'  },
          { href: '/locations',           label: '出店ログ登録',     color: 'bg-green-50 border-green-200 text-green-700' },
          { href: '/analytics/locations', label: '場所別分析',       color: 'bg-purple-50 border-purple-200 text-purple-700' },
          { href: '/analytics/products',  label: '商品別分析',       color: 'bg-orange-50 border-orange-200 text-orange-700' },
        ].map(({ href, label, color }) => (
          <a
            key={href}
            href={href}
            className={`border rounded-xl p-4 text-center text-sm font-medium hover:opacity-80 transition ${color}`}
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  )
}