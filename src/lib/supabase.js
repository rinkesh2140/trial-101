import { createClient } from '@supabase/supabase-js'

const URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://yzevducedcvxvugozmbu.supabase.co'
const KEY  = import.meta.env.VITE_SUPABASE_KEY  || 'sb_publishable_sFuIGiOOco0RjlCVGG5C6Q_2VDCou5C'

export const supabase = createClient(URL, KEY)
