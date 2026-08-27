import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import Docs from './page'

// Mock the CursorGlow component to avoid testing complex animations
jest.mock('@/components/cursor-glow', () => ({
  CursorGlow: () => <div data-testid="mock-cursor-glow" />
}))

describe('Docs Page', () => {
  it('renders the documentation heading', () => {
    render(<Docs />)
    const heading = screen.getByRole('heading', { level: 1, name: /Documentation/i })
    expect(heading).toBeInTheDocument()
  })

  it('renders the sections', () => {
    render(<Docs />)
    expect(screen.getByText('Constraint Pinning')).toBeInTheDocument()
    expect(screen.getByText('Hash Chain Integrity')).toBeInTheDocument()
    expect(screen.getByText('Poisoning Detection')).toBeInTheDocument()
    expect(screen.getByText('Time-Travel Queries')).toBeInTheDocument()
  })
})
