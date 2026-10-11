// Shared by Server Actions and client forms. Kept free of zod so it adds
// nothing to the browser bundle.

export type FieldErrors = Partial<Record<string, string>>

export type ActionState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: FieldErrors
}

export const idleState: ActionState = { status: 'idle' }

export function errorState(message: string, fieldErrors?: FieldErrors): ActionState {
  return { status: 'error', message, fieldErrors }
}

export function successState(message: string): ActionState {
  return { status: 'success', message }
}
