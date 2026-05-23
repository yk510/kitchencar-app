import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const email = process.env.APP_REVIEW_EMAIL ?? 'app-review@kuridas.app'
const password = process.env.APP_REVIEW_PASSWORD ?? 'AppReview-2026!'

if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function storeCodeFromUserId(userId) {
  const value = parseInt(userId.replace(/-/g, '').slice(0, 8), 16)
  return String((value % 9000) + 1000).padStart(4, '0')
}

async function upsertSingle(table, row, options) {
  const { data, error } = await supabase.from(table).upsert([row], options).select('*').single()
  if (error) throw new Error(`${table}: ${error.message}`)
  return data
}

async function findSingle(table, column, value) {
  const { data, error } = await supabase.from(table).select('*').eq(column, value).limit(1)
  if (error) throw new Error(`${table}: ${error.message}`)
  return data?.[0] ?? null
}

async function main() {
  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'vendor',
      display_name: 'App Review 店舗',
    },
  })

  if (createError && !createError.message.toLowerCase().includes('already')) {
    throw createError
  }

  let user = createdUser?.user ?? null

  if (!user) {
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw listError
    user = users.users.find((entry) => entry.email === email) ?? null
  }

  if (!user) {
    throw new Error(`Could not resolve app review user: ${email}`)
  }

  await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: {
      role: 'vendor',
      display_name: 'App Review 店舗',
    },
  })

  await upsertSingle(
    'user_profiles',
    { user_id: user.id, role: 'vendor', display_name: 'App Review 店舗' },
    { onConflict: 'user_id' }
  )

  await upsertSingle(
    'vendor_profiles',
    {
      user_id: user.id,
      business_name: 'App Review 店舗',
      owner_name: 'Apple Reviewer',
      contact_email: email,
      phone: '000-0000-0000',
      genre: 'other',
      main_menu: 'レビュー用カレー',
      description: 'App Store審査用のテスト店舗です。',
    },
    { onConflict: 'user_id' }
  )

  const slug = `app-review-${user.id.slice(0, 8)}`
  const existingStore = await findSingle('vendor_stores', 'vendor_user_id', user.id)
  const storeSettings = {
    store_name: 'App Review 店舗',
    slug,
    store_code: storeCodeFromUserId(user.id),
    is_mobile_order_enabled: true,
    is_accepting_orders: true,
    is_store_pos_enabled: true,
    store_pos_terminal_name: 'app-review-ipad',
    store_pos_enabled_payment_methods: ['cash', 'paypay', 'other'],
    is_receipt_print_enabled: true,
    receipt_printer_provider: 'ios_webview_wrapper',
    receipt_printer_endpoint: null,
    receipt_printer_label: 'MP-B20',
    receipt_print_mode: 'auto_after_payment',
  }
  const storeMutation = existingStore
    ? await supabase.from('vendor_stores').update(storeSettings).eq('id', existingStore.id).select('*').single()
    : await supabase
        .from('vendor_stores')
        .insert([
          {
            vendor_user_id: user.id,
            ...storeSettings,
          },
        ])
        .select('*')
        .single()

  if (storeMutation.error) throw new Error(`vendor_stores: ${storeMutation.error.message}`)
  const store = storeMutation.data

  const { data: existingPages, error: pageQueryError } = await supabase
    .from('store_order_pages')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_primary', true)
    .limit(1)

  if (pageQueryError) throw new Error(`store_order_pages: ${pageQueryError.message}`)

  let page = existingPages?.[0] ?? null
  if (!page) {
    const { data: insertedPage, error: pageInsertError } = await supabase
      .from('store_order_pages')
      .insert([
        {
          store_id: store.id,
          page_title: 'App Review 店舗 モバイルオーダー',
          public_token: crypto.randomUUID().replace(/-/g, ''),
          status: 'published',
          is_primary: true,
        },
      ])
      .select('*')
      .single()

    if (pageInsertError) throw new Error(`store_order_pages: ${pageInsertError.message}`)
    page = insertedPage
  } else {
    const { data: updatedPage, error: pageUpdateError } = await supabase
      .from('store_order_pages')
      .update({
        page_title: 'App Review 店舗 モバイルオーダー',
        status: 'published',
        is_primary: true,
      })
      .eq('id', page.id)
      .select('*')
      .single()

    if (pageUpdateError) throw new Error(`store_order_pages: ${pageUpdateError.message}`)
    page = updatedPage
  }

  const reviewProducts = [
    {
      store_id: store.id,
      name: 'レビュー用カレー',
      description: '審査で注文作成を確認するための商品です。',
      price: 800,
      sort_order: 1,
      display_category: 'main',
      is_recommended: true,
      tracks_inventory: false,
      low_stock_threshold: 3,
      is_published: true,
      is_sold_out: false,
    },
    {
      store_id: store.id,
      name: 'レビュー用ドリンク',
      description: '追加注文確認用の商品です。',
      price: 300,
      sort_order: 2,
      display_category: 'drink',
      is_recommended: false,
      tracks_inventory: false,
      low_stock_threshold: 3,
      is_published: true,
      is_sold_out: false,
    },
  ]

  for (const product of reviewProducts) {
    const { data: existingProducts, error: productQueryError } = await supabase
      .from('mobile_order_products')
      .select('id')
      .eq('store_id', store.id)
      .eq('name', product.name)
      .limit(1)

    if (productQueryError) throw new Error(`mobile_order_products: ${productQueryError.message}`)

    const productMutation = existingProducts?.[0]
      ? await supabase.from('mobile_order_products').update(product).eq('id', existingProducts[0].id)
      : await supabase.from('mobile_order_products').insert([product])

    if (productMutation.error) throw new Error(`mobile_order_products: ${productMutation.error.message}`)
  }

  const now = new Date()
  const opensAt = new Date(now.getTime() - 60 * 60 * 1000)
  const closesAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const { error: scheduleError } = await supabase.from('store_order_schedules').upsert(
    [
      {
        store_id: store.id,
        order_page_id: page.id,
        business_date: now.toISOString().slice(0, 10),
        opens_at: opensAt.toISOString(),
        closes_at: closesAt.toISOString(),
        status: 'open',
        notes: 'App Store Review active schedule',
      },
    ],
    { onConflict: 'order_page_id,business_date,opens_at' }
  )

  if (scheduleError) throw new Error(`store_order_schedules: ${scheduleError.message}`)

  console.log(
    JSON.stringify(
      {
        email,
        password,
        store_pos_path: `/store-pos/${page.public_token}`,
        orders_path: '/vendor/mobile-order/orders',
        settings_path: '/vendor/mobile-order',
        privacy_path: '/privacy',
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
