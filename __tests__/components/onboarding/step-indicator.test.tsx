import { render, screen } from '@testing-library/react'
import { StepIndicator } from '@/components/onboarding/step-indicator'

describe('StepIndicator', () => {
  it('renders correct number of steps', () => {
    render(<StepIndicator currentStep={1} totalSteps={2} labels={['Family', 'Role & Avatar']} />)

    expect(screen.getByText('Family')).toBeInTheDocument()
    expect(screen.getByText('Role & Avatar')).toBeInTheDocument()
  })

  it('highlights current step with aria-current', () => {
    render(<StepIndicator currentStep={1} totalSteps={2} labels={['Family', 'Role & Avatar']} />)

    const currentStepCircle = screen.getByText('1').closest('div')
    expect(currentStepCircle).toHaveAttribute('aria-current', 'step')
  })

  it('shows step 2 as current when currentStep is 2', () => {
    render(<StepIndicator currentStep={2} totalSteps={2} labels={['Family', 'Role & Avatar']} />)

    const step2Circle = screen.getByText('2').closest('div')
    expect(step2Circle).toHaveAttribute('aria-current', 'step')
  })

  it('shows completed steps with checkmark instead of number', () => {
    render(<StepIndicator currentStep={2} totalSteps={2} labels={['Family', 'Role & Avatar']} />)

    // Step 1 is complete - should not show "1" text
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    // Step 2 is current - should show "2"
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders a single step when totalSteps is 1', () => {
    render(<StepIndicator currentStep={1} totalSteps={1} labels={['Role & Avatar']} />)

    expect(screen.getByText('Role & Avatar')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('shows labels for all steps', () => {
    render(<StepIndicator currentStep={1} totalSteps={3} labels={['Step A', 'Step B', 'Step C']} />)

    expect(screen.getByText('Step A')).toBeInTheDocument()
    expect(screen.getByText('Step B')).toBeInTheDocument()
    expect(screen.getByText('Step C')).toBeInTheDocument()
  })

  it('applies purple styling to current step label', () => {
    render(<StepIndicator currentStep={1} totalSteps={2} labels={['Family', 'Role & Avatar']} />)

    const familyLabel = screen.getByText('Family')
    expect(familyLabel).toHaveClass('text-purple-600')
    expect(familyLabel).toHaveClass('font-medium')
  })

  it('applies gray styling to non-current step labels', () => {
    render(<StepIndicator currentStep={1} totalSteps={2} labels={['Family', 'Role & Avatar']} />)

    const roleLabel = screen.getByText('Role & Avatar')
    expect(roleLabel).toHaveClass('text-gray-400')
  })

  it('does not set aria-current on non-current steps', () => {
    render(<StepIndicator currentStep={1} totalSteps={2} labels={['Family', 'Role & Avatar']} />)

    const step2Circle = screen.getByText('2').closest('div')
    expect(step2Circle).not.toHaveAttribute('aria-current')
  })

  it('renders connecting line between steps', () => {
    const { container } = render(
      <StepIndicator currentStep={1} totalSteps={2} labels={['Family', 'Role & Avatar']} />
    )

    // There should be a connecting line (div with h-0.5)
    const lines = container.querySelectorAll('.h-0\\.5')
    expect(lines).toHaveLength(1)
  })

  it('does not render connecting line after last step', () => {
    const { container } = render(
      <StepIndicator currentStep={1} totalSteps={1} labels={['Only Step']} />
    )

    const lines = container.querySelectorAll('.h-0\\.5')
    expect(lines).toHaveLength(0)
  })

  it('fills connecting line with purple when step before it is complete', () => {
    const { container } = render(
      <StepIndicator currentStep={2} totalSteps={2} labels={['Family', 'Role & Avatar']} />
    )

    const line = container.querySelector('.h-0\\.5')
    expect(line).toHaveClass('bg-purple-600')
  })

  it('fills connecting line with gray when step before it is not complete', () => {
    const { container } = render(
      <StepIndicator currentStep={1} totalSteps={2} labels={['Family', 'Role & Avatar']} />
    )

    const line = container.querySelector('.h-0\\.5')
    expect(line).toHaveClass('bg-gray-300')
  })
})
