import { useSession } from '../../context/SessionContext/SessionContext';
import type { AuthCardProps } from './types';

export function AuthCard({ errorMessage }: AuthCardProps) {
  const {
    authMode,
    authForm,
    isLoading,
    setAuthForm,
    setAuthMode,
    submitAuthForm,
  } = useSession();

  return (
    <section className="card auth-card">
      <h1>Bard's Journal</h1>
      <p>Personal journals with role-based access and admin overview.</p>

      <div className="tabs">
        <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')} type="button">
          Login
        </button>
        <button className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')} type="button">
          Register
        </button>
      </div>

      <form onSubmit={submitAuthForm} className="form">
        <label>
          Email
          <input
            type="email"
            value={authForm.email}
            onChange={(event) => setAuthForm((previous) => ({ ...previous, email: event.target.value }))}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            minLength={6}
            value={authForm.password}
            onChange={(event) => setAuthForm((previous) => ({ ...previous, password: event.target.value }))}
            required
          />
        </label>

        <button disabled={isLoading} type="submit">
          {authMode === 'register' ? 'Create account' : 'Login'}
        </button>
      </form>

      {errorMessage ? <p className="error">{errorMessage}</p> : null}
    </section>
  );
}
