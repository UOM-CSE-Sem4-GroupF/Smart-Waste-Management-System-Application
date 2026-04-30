import { render, screen } from '@testing-library/react'
import { BinStatusBadge } from '../BinStatusBadge'

it.each(['normal', 'monitor', 'urgent', 'critical', 'offline'])(
  'renders %s status with correct text',
  (status) => {
    render(<BinStatusBadge status={status as any} />)
    expect(screen.getByText(status)).toBeInTheDocument()
  }
)
