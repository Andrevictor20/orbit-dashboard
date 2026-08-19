import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the dashboard header', () => {
    render(<App />)
    expect(screen.getByText('HomelabStore')).toBeDefined()
    expect(screen.getByText('Homelab Dashboard')).toBeDefined()
  })
})
