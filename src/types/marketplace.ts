export type ApplicationStatus =
  | 'inquiry'
  | 'pending'
  | 'under_review'
  | 'accepted'
  | 'rejected'

export type MarketplaceMessage = {
  id: string
  sender_role: 'vendor' | 'organizer'
  message: string
  created_at: string
}

export type OrganizerProfile = {
  organizer_name: string
  contact_name: string | null
  contact_email: string | null
  phone: string | null
  logo_image_url: string | null
  instagram_url: string | null
  x_url: string | null
  description: string | null
}

export type VendorProfile = {
  business_name: string
  owner_name: string | null
  contact_email: string | null
  phone: string | null
  genre: string | null
  main_menu: string | null
  logo_image_url: string | null
  instagram_url: string | null
  x_url: string | null
  description: string | null
}

export type OrganizerPublicProfile = {
  user_id: string
  organizer_name: string
  contact_name: string | null
  logo_image_url: string | null
  instagram_url: string | null
  x_url: string | null
  description: string | null
}

export type VendorPublicProfile = {
  user_id: string
  business_name: string
  owner_name: string | null
  contact_email: string | null
  phone: string | null
  genre: string | null
  main_menu: string | null
  logo_image_url: string | null
  instagram_url: string | null
  x_url: string | null
  description: string | null
}

export type OfferFeeType = 'fixed' | 'revenue_share' | 'fixed_plus_revenue_share' | 'free'

export type EventOfferCore = {
  id: string
  title: string
  event_date: string
  event_end_date: string | null
  venue_name: string
  venue_address: string | null
  municipality: string | null
  recruitment_count: number
  fee_type: OfferFeeType
  stall_fee: number | null
  revenue_share_rate: number | null
  application_deadline: string | null
  load_in_start_time: string | null
  load_in_end_time: string | null
  sales_start_time: string | null
  sales_end_time: string | null
  load_out_start_time: string | null
  load_out_end_time: string | null
  provided_facilities: string[] | null
  photo_urls: string[] | null
  venue_features: string | null
  recruitment_purpose: string | null
  required_equipment: string | null
  notes: string | null
}

export type OrganizerEventOffer = EventOfferCore & {
  status: 'draft' | 'open' | 'closed'
  is_public: boolean
  application_count: number
  accepted_count: number
}

export type VendorOfferListItem = Pick<
  EventOfferCore,
  | 'id'
  | 'title'
  | 'event_date'
  | 'event_end_date'
  | 'venue_name'
  | 'municipality'
  | 'recruitment_count'
  | 'stall_fee'
  | 'application_deadline'
> & {
  organizer_name: string
  my_application: {
    id: string
    status: ApplicationStatus
    last_message_at: string
  } | null
}

export type VendorOfferDetail = EventOfferCore & {
  organizer_name: string
  organizer_contact_name: string | null
  organizer_logo_image_url: string | null
  organizer_instagram_url: string | null
  organizer_x_url: string | null
  organizer_description: string | null
  my_application: {
    id: string
    status: ApplicationStatus
    initial_message: string | null
  } | null
}

export type OrganizerApplicationRow = {
  id: string
  vendor_user_id: string
  status: ApplicationStatus
  contact_released_at: string | null
  vendor_name: string | null
  vendor_business_name: string
  vendor_contact_name: string | null
  initial_message: string | null
  unread_count: number
  offer: {
    title: string
    event_date: string
    event_end_date: string | null
    venue_name: string
  } | null
}

export type VendorApplicationRow = {
  id: string
  status: ApplicationStatus
  last_message_at: string
  initial_message: string | null
  contact_released_at: string | null
  organizer_name: string | null
  unread_count: number
  offer: {
    id: string
    title: string
    event_date: string
    event_end_date: string | null
    venue_name: string
  } | null
}

export type SharedLocation = {
  id: string
  name: string
  address: string
}
