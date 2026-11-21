import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aiChat,
  customerCreate,
  customerUpdate,
  invoiceCreate,
  invoiceUpdate,
  paginationQuery,
  saleCreate,
} from '../../api/_lib/validation'

const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111'

test('customerCreate accepts a minimal customer and applies defaults', () => {
  const parsed = customerCreate.parse({ name: '  Aziz  ' })
  assert.equal(parsed.name, 'Aziz')
  assert.equal(parsed.status, 'new')
})

test('customerCreate rejects unknown fields (mass assignment)', () => {
  const result = customerCreate.safeParse({ name: 'Aziz', organization_id: CUSTOMER_ID })
  assert.equal(result.success, false)
})

test('customerCreate rejects invalid email and empty name', () => {
  assert.equal(customerCreate.safeParse({ name: 'A', email: 'not-an-email' }).success, false)
  assert.equal(customerCreate.safeParse({ name: '   ' }).success, false)
})

test('customerUpdate requires at least one field', () => {
  assert.equal(customerUpdate.safeParse({}).success, false)
  assert.equal(customerUpdate.safeParse({ notes: null }).success, true)
})

test('invoiceUpdate can never set the paid status', () => {
  assert.equal(invoiceUpdate.safeParse({ status: 'paid' }).success, false)
  assert.equal(invoiceUpdate.safeParse({ status: 'sent' }).success, true)
})

test('invoiceCreate requires a customer and at least one item', () => {
  const base = {
    customerId: CUSTOMER_ID,
    dueDate: '2026-12-01',
    items: [{ description: 'Non', quantity: 2, unitPrice: 5000 }],
  }
  assert.equal(invoiceCreate.safeParse(base).success, true)
  assert.equal(invoiceCreate.safeParse({ ...base, items: [] }).success, false)
  assert.equal(invoiceCreate.safeParse({ ...base, customerId: 'nope' }).success, false)
})

test('saleCreate rejects negative prices and non-integer quantity', () => {
  assert.equal(
    saleCreate.safeParse({
      items: [{ description: 'Non', quantity: 1, unitPrice: -5 }],
    }).success,
    false,
  )
  assert.equal(
    saleCreate.safeParse({
      items: [{ description: 'Non', quantity: 1.5, unitPrice: 5 }],
    }).success,
    false,
  )
})

test('paginationQuery coerces query strings and caps the page size', () => {
  const parsed = paginationQuery.parse({ limit: '10', offset: '20' })
  assert.equal(parsed.limit, 10)
  assert.equal(parsed.offset, 20)
  assert.equal(paginationQuery.safeParse({ limit: '500' }).success, false)
})

test('aiChat bounds the number of messages and message size', () => {
  const one = [{ role: 'user', content: 'Salom' }]
  assert.equal(aiChat.safeParse({ messages: one }).success, true)
  assert.equal(aiChat.safeParse({ messages: [] }).success, false)
  assert.equal(
    aiChat.safeParse({ messages: Array.from({ length: 21 }, () => one[0]) }).success,
    false,
  )
  assert.equal(aiChat.safeParse({ messages: [{ role: 'system', content: 'x' }] }).success, false)
})
