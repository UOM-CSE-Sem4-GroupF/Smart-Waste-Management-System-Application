import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { BinStatusBadge } from '../BinStatusBadge'
import type { BinStatus } from '@/types'

const statuses: BinStatus[] = ['normal', 'monitor', 'urgent', 'critical', 'offline']

it.each<BinStatus>(statuses)('renders %s status with correct text', (status) => {
  render(<BinStatusBadge status={status} />)
  expect(screen.getByText(status)).toBeInTheDocument()
})
