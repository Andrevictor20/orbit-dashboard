import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the dashboard header', () => {
    render(<App />)
    expect(screen.getByText('Orbit')).toBeDefined()
    expect(screen.getByText('Orbit Dashboard')).toBeDefined()
  })
})
