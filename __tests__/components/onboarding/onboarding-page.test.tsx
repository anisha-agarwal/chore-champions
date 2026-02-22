import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingPage from '@/app/(auth)/onboarding/page'

// Mock next/navigation
const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}))

// Mock Supabase client
const mockGetUser = jest.fn()
const mockSelect = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      select: (...args: unknown[]) => ({
        eq: (...eqArgs: unknown[]) => ({
          single: () => mockSelect(...args, ...eqArgs),
        }),
      }),
      update: () => ({
        eq: () => ({ error: null }),
      }),
      insert: () => ({
        select: () => ({
          single: () => ({ data: { id: 'new-family' }, error: null }),
        }),
      }),
    }),
    rpc: () => ({
      single: () => ({ data: { id: 'family-1', name: 'Test' }, error: null }),
    }),
  }),
}))

// Mock child components to simplify testing
jest.mock('@/components/onboarding/step-indicator', () => ({
  StepIndicator: ({ currentStep, totalSteps, labels }: { currentStep: number; totalSteps: number; labels: string[] }) => (
    <div data-testid="step-indicator" data-current={currentStep} data-total={totalSteps}>
      {labels.join(', ')}
    </div>
  ),
}))

jest.mock('@/components/onboarding/family-step', () => ({
  FamilyStep: ({ onComplete }: { onComplete: (id: string) => void }) => (
    <div data-testid="family-step">
      <button onClick={() => onComplete('family-123')}>Complete Family</button>
    </div>
  ),
}))

jest.mock('@/components/onboarding/role-avatar-step', () => ({
  RoleAvatarStep: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="role-avatar-step">
      <button onClick={() => onComplete()}>Complete Role</button>
    </div>
  ),
}))

describe('OnboardingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('shows loading spinner initially', () => {
    // Never resolves - stays loading
    mockSelect.mockReturnValue(new Promise(() => {}))

    render(<OnboardingPage />)

    // Should show spinner (no step content yet)
    expect(screen.queryByTestId('family-step')).not.toBeInTheDocument()
    expect(screen.queryByTestId('role-avatar-step')).not.toBeInTheDocument()
  })

  it('starts at family step when user has no family_id', async () => {
    mockSelect.mockResolvedValue({ data: { family_id: null }, error: null })

    render(<OnboardingPage />)

    await waitFor(() => {
      expect(screen.getByTestId('family-step')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('role-avatar-step')).not.toBeInTheDocument()
  })

  it('starts at role-avatar step when user has family_id', async () => {
    mockSelect.mockResolvedValue({ data: { family_id: 'existing-family' }, error: null })

    render(<OnboardingPage />)

    await waitFor(() => {
      expect(screen.getByTestId('role-avatar-step')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('family-step')).not.toBeInTheDocument()
  })

  it('shows step indicator with 2 steps when no family_id', async () => {
    mockSelect.mockResolvedValue({ data: { family_id: null }, error: null })

    render(<OnboardingPage />)

    await waitFor(() => {
      const indicator = screen.getByTestId('step-indicator')
      expect(indicator).toHaveAttribute('data-total', '2')
      expect(indicator).toHaveAttribute('data-current', '1')
      expect(indicator).toHaveTextContent('Family, Role & Avatar')
    })
  })

  it('shows step indicator with 1 step when family_id exists', async () => {
    mockSelect.mockResolvedValue({ data: { family_id: 'existing-family' }, error: null })

    render(<OnboardingPage />)

    await waitFor(() => {
      const indicator = screen.getByTestId('step-indicator')
      expect(indicator).toHaveAttribute('data-total', '1')
      expect(indicator).toHaveAttribute('data-current', '1')
      expect(indicator).toHaveTextContent('Role & Avatar')
    })
  })

  it('transitions from family to role-avatar step on family completion', async () => {
    mockSelect.mockResolvedValue({ data: { family_id: null }, error: null })

    render(<OnboardingPage />)

    await waitFor(() => {
      expect(screen.getByTestId('family-step')).toBeInTheDocument()
    })

    // Complete family step
    await userEvent.click(screen.getByText('Complete Family'))

    await waitFor(() => {
      expect(screen.getByTestId('role-avatar-step')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('family-step')).not.toBeInTheDocument()
  })

  it('redirects to /quests on role-avatar completion', async () => {
    mockSelect.mockResolvedValue({ data: { family_id: 'existing-family' }, error: null })

    render(<OnboardingPage />)

    await waitFor(() => {
      expect(screen.getByTestId('role-avatar-step')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Complete Role'))

    expect(mockPush).toHaveBeenCalledWith('/quests')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('redirects to /login when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    render(<OnboardingPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('shows Welcome heading', async () => {
    mockSelect.mockResolvedValue({ data: { family_id: null }, error: null })

    render(<OnboardingPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Welcome!' })).toBeInTheDocument()
    })
  })

  it('shows setup text', async () => {
    mockSelect.mockResolvedValue({ data: { family_id: null }, error: null })

    render(<OnboardingPage />)

    await waitFor(() => {
      expect(screen.getByText(/let's get you set up/i)).toBeInTheDocument()
    })
  })

  it('updates step indicator to step 2 after family completion', async () => {
    mockSelect.mockResolvedValue({ data: { family_id: null }, error: null })

    render(<OnboardingPage />)

    await waitFor(() => {
      expect(screen.getByTestId('family-step')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Complete Family'))

    await waitFor(() => {
      const indicator = screen.getByTestId('step-indicator')
      expect(indicator).toHaveAttribute('data-current', '2')
      expect(indicator).toHaveAttribute('data-total', '2')
    })
  })
})
