import { db } from '@/server/db'
import { endpoint } from '@/server/api/endpoint'
import * as uc from '@/server/usecases/tasks'

export const dynamic = 'force-dynamic'

export const POST = endpoint(async ({ form }) => uc.uploadCover((await form()).get('file')), 201)
