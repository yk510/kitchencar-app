import type {
  PublicMobileOrderOptionChoice,
  PublicMobileOrderProduct,
} from '@/types/api-payloads'

export type PublicOrderProductSelection = {
  selectedChoiceIdsByGroup: Record<string, string[]>
  quantity: number
}

export type PublicOrderSelectedOptionChoice = {
  choice_id: string
  choice_name: string
  price_delta: number
}

export type PublicOrderSelectedOptionGroup = {
  group_id: string
  group_name: string
  choices: PublicOrderSelectedOptionChoice[]
}

export type PublicOrderCartItemCore = {
  product_id: string
  product_name: string
  product_price: number
  unit_price: number
  quantity: number
  line_total: number
  selected_option_choice_ids: string[]
  selected_options: PublicOrderSelectedOptionGroup[]
}

export function buildInitialProductSelection(
  product: PublicMobileOrderProduct
): PublicOrderProductSelection {
  const selectedChoiceIdsByGroup: Record<string, string[]> = {}

  for (const group of product.option_groups) {
    const activeChoices = group.choices.filter((choice) => choice.is_active)
    if (group.selection_type === 'single' && group.is_required && activeChoices[0]) {
      selectedChoiceIdsByGroup[group.id] = [activeChoices[0].id]
    } else {
      selectedChoiceIdsByGroup[group.id] = []
    }
  }

  return {
    selectedChoiceIdsByGroup,
    quantity: 1,
  }
}

export function getPublicOrderCartLineTotal(
  product: PublicMobileOrderProduct,
  selection: PublicOrderProductSelection
) {
  const optionTotal = product.option_groups.reduce((sum, group) => {
    const selectedIds = selection.selectedChoiceIdsByGroup[group.id] ?? []
    const selectedChoices = group.choices.filter((choice) => selectedIds.includes(choice.id))
    return sum + selectedChoices.reduce((choiceSum, choice) => choiceSum + choice.price_delta, 0)
  }, 0)

  return (product.price + optionTotal) * selection.quantity
}

export function validatePublicOrderSelection(
  product: PublicMobileOrderProduct,
  selection: PublicOrderProductSelection
) {
  for (const group of product.option_groups) {
    const selectedIds = selection.selectedChoiceIdsByGroup[group.id] ?? []

    if (group.is_required && selectedIds.length === 0) {
      return `${group.name} を選択してください`
    }

    if (group.selection_type === 'single' && selectedIds.length > 1) {
      return `${group.name} は1つだけ選択できます`
    }

    if (group.min_select != null && selectedIds.length < group.min_select) {
      return `${group.name} は ${group.min_select} 件以上選択してください`
    }

    if (group.max_select != null && selectedIds.length > group.max_select) {
      return `${group.name} は ${group.max_select} 件まで選択できます`
    }
  }

  if (selection.quantity < 1) {
    return '数量は1以上にしてください'
  }

  return null
}

export function buildSelectedOptions(
  product: PublicMobileOrderProduct,
  selection: PublicOrderProductSelection
) {
  return product.option_groups
    .map((group) => {
      const selectedIds = selection.selectedChoiceIdsByGroup[group.id] ?? []
      const selectedChoices = group.choices
        .filter((choice) => selectedIds.includes(choice.id))
        .map((choice) => ({
          choice_id: choice.id,
          choice_name: choice.name,
          price_delta: choice.price_delta,
        }))

      return {
        group_id: group.id,
        group_name: group.name,
        choices: selectedChoices,
      }
    })
    .filter((group) => group.choices.length > 0)
}

export function buildPublicOrderCartItemCore(
  product: PublicMobileOrderProduct,
  selection: PublicOrderProductSelection
): PublicOrderCartItemCore {
  const selected_options = buildSelectedOptions(product, selection)
  const selected_option_choice_ids = selected_options.flatMap((group) =>
    group.choices.map((choice) => choice.choice_id)
  )
  const unit_price = getPublicOrderCartLineTotal(product, { ...selection, quantity: 1 })

  return {
    product_id: product.id,
    product_name: product.name,
    product_price: product.price,
    unit_price,
    quantity: selection.quantity,
    line_total: unit_price * selection.quantity,
    selected_option_choice_ids,
    selected_options,
  }
}

export function getPublicOrderChoicePriceLabel(choice: PublicMobileOrderOptionChoice) {
  return choice.price_delta > 0 ? `+${choice.price_delta.toLocaleString()}円` : '+0円'
}

export function isPublicOrderProductUnavailable(product: PublicMobileOrderProduct) {
  return ['loading', 'sold_out', 'not_set'].includes(product.current_inventory_status) || product.is_sold_out
}

export function getPublicOrderProductUnavailableState(product: PublicMobileOrderProduct) {
  if (product.current_inventory_status === 'loading') return 'loading'
  if (product.current_inventory_status === 'not_set') return 'not_set'
  if (product.current_inventory_status === 'sold_out' || product.is_sold_out) return 'sold_out'
  return null
}

export function getPublicOrderInventoryBadge(product: PublicMobileOrderProduct) {
  if (product.current_inventory_status === 'loading') {
    return { label: '在庫確認中', className: 'bg-sky-100 text-sky-700' }
  }
  if (product.current_inventory_status === 'not_set') {
    return { label: '在庫準備中', className: 'bg-slate-100 text-slate-700' }
  }
  if (product.current_inventory_status === 'sold_out') {
    return { label: '売り切れ', className: 'bg-amber-100 text-amber-800' }
  }
  if (product.current_inventory_status === 'low_stock') {
    return { label: '残りわずか', className: 'bg-orange-100 text-orange-800' }
  }
  if (product.tracks_inventory && product.current_remaining_quantity != null) {
    return { label: `残り ${product.current_remaining_quantity}`, className: 'bg-emerald-50 text-emerald-700' }
  }
  return null
}
