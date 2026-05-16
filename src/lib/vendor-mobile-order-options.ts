import type {
  MobileOrderProductRow,
  VendorMobileOrderOptionGroup,
} from '@/types/api-payloads'

export type ChoiceForm = {
  name: string
  price_delta: string
  sort_order: string
  is_active: boolean
}

export type OptionGroupForm = {
  name: string
  selection_type: 'single' | 'multiple'
  is_required: boolean
  min_select: string
  max_select: string
  sort_order: string
  linked_product_ids: string[]
  choices: ChoiceForm[]
}

export const EMPTY_CHOICE: ChoiceForm = {
  name: '',
  price_delta: '0',
  sort_order: '0',
  is_active: true,
}

export const EMPTY_FORM: OptionGroupForm = {
  name: '',
  selection_type: 'single',
  is_required: false,
  min_select: '',
  max_select: '',
  sort_order: '0',
  linked_product_ids: [],
  choices: [{ ...EMPTY_CHOICE }],
}

export function buildFormFromOptionGroup(group: VendorMobileOrderOptionGroup): OptionGroupForm {
  return {
    name: group.name,
    selection_type: group.selection_type,
    is_required: group.is_required,
    min_select: group.min_select == null ? '' : String(group.min_select),
    max_select: group.max_select == null ? '' : String(group.max_select),
    sort_order: String(group.sort_order),
    linked_product_ids: group.linked_product_ids,
    choices: group.choices.map((choice) => ({
      name: choice.name,
      price_delta: String(choice.price_delta),
      sort_order: String(choice.sort_order),
      is_active: choice.is_active,
    })),
  }
}

export function getLinkedProductNames(products: MobileOrderProductRow[], productIds: string[]) {
  const map = new Map(products.map((product) => [product.id, product.name]))
  return productIds.map((productId) => map.get(productId)).filter(Boolean).join(' / ')
}
