import { handle } from '@/lib/api'

export const GET = handle({}, async (_req, { user }) => ({ user }))
