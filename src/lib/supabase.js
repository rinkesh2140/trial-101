import { createClient } from '@supabase/supabase-js'

const URL  = 'https://yzevducedcvxvugozmbu.supabase.co'
const KEY  = 'sb_publishable_sFuIGiOOco0RjlCVGG5C6Q_2VDCou5C'

export const supabase = createClient(URL, KEY)
