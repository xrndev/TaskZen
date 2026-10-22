import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/profile'

export const dynamic = 'force-dynamic'

export const POST = endpoint(async ({ form }) => uc.uploadAvatar((await form()).get('file')), 201)
