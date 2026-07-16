import { useState } from 'react';
import { ArrowRight, CheckCircle2, Lock, UserPlus } from 'lucide-react';
import { apiLogin, apiRegister, normaliseUser } from '../api';
import { useLanguage } from '../i18n';
import { navigateTo } from '../navigation';
import { writeUserToken } from '../sessionAuth';

export function AuthPage({ Header, mode, setRoute, setUser, setUserToken, authProblem = '', clearAuthProblem = () => {} }) {
    const { t } = useLanguage();
    const isRegister = mode === 'register';
    const [form, setForm] = useState(emptyAuthForm);
    const [registerStep, setRegisterStep] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const registerSteps = getRegisterSteps(form);
    const activeStep = registerSteps[registerStep] || registerSteps[0];
    const activeChecks = activeStep?.checks || [];
    const stepValid = activeChecks.every((check) => check.valid);

    async function submit() {
        setError('');
        clearAuthProblem();
        if (isRegister) {
            const invalidStep = registerSteps.findIndex((step) => step.checks.some((check) => !check.valid));
            if (invalidStep >= 0) {
                setRegisterStep(invalidStep);
                setError('Finish the highlighted step before creating the account.');
                return;
            }
        }
        setLoading(true);
        recordAuthTelemetry(isRegister ? 'register_submit' : 'login_submit');
        try {
            const response = isRegister
                ? await apiRegister(registerPayload(form))
                : await apiLogin({ identifier: form.identifier, password: form.password });
            if (!response.token) {
                setError('Account created. Email verification is required before login; ask an admin to verify the account.');
                return;
            }
            writeUserToken(response.token);
            setUserToken(response.token);
            setUser(normaliseUser(response.user));
            navigateTo(setRoute, 'dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function updateForm(patch) {
        setForm((current) => ({ ...current, ...patch }));
        setError('');
    }

    function handleAuthSubmit(event) {
        event.preventDefault();
        if (loading) return;
        if (isRegister && registerStep < registerSteps.length - 1) {
            if (!stepValid) {
                setError('Complete the checks on this step before continuing.');
                return;
            }
            setError('');
            setRegisterStep((current) => Math.min(current + 1, registerSteps.length - 1));
            return;
        }
        submit();
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={null} userToken="" setUser={setUser} setUserToken={setUserToken} />
            <main className="authWrap contentFadeIn">
                <form className="authCard" onSubmit={handleAuthSubmit}>
                    <span className="eyebrow">{isRegister ? t('createAccount') : t('welcomeBack')}</span>
                    <h1>{isRegister ? t('privateAuditWorkspace') : t('loginToContinue')}</h1>
                    {authProblem && <div className="error compact">{authProblem}</div>}
                    {isRegister ? (
                        <div className="registerWizard">
                            <div className="registerProgress" aria-label={t('registrationProgress')}>
                                <div className="progressTop">
                                    <strong>{registerStep + 1}/{registerSteps.length}</strong>
                                    <span>{activeStep.title}</span>
                                </div>
                                <div className="progressRail"><span style={{ width: `${((registerStep + 1) / registerSteps.length) * 100}%` }} /></div>
                                <div className="stepDots">
                                    {registerSteps.map((step, index) => (
                                        <button type="button" key={step.title} className={index === registerStep ? 'active' : index < registerStep ? 'done' : ''} onClick={() => index <= registerStep && setRegisterStep(index)} disabled={index > registerStep} aria-label={`Step ${index + 1}: ${step.title}`}>
                                            {index + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="registerStepPanel" key={registerStep}>
                                <div className="stepHead"><span className="eyebrow">{t('step')} {registerStep + 1}</span><h2>{activeStep.title}</h2></div>
                                <RegisterStep step={registerStep} form={form} updateForm={updateForm} t={t} />
                                <ValidationList checks={activeChecks} />
                                <div className="stepActions">
                                    <button className="ghost" disabled={registerStep === 0 || loading} onClick={() => {
                                        setError('');
                                        setRegisterStep((current) => Math.max(current - 1, 0));
                                    }} type="button">{t('back')}</button>
                                    {registerStep < registerSteps.length - 1 ? (
                                        <button className="primary" disabled={!stepValid || loading} type="submit">{t('next')} <ArrowRight size={18} /></button>
                                    ) : (
                                        <button className="primary" disabled={!stepValid || loading} type="submit"><UserPlus size={18} /> {loading ? t('working') : t('createAccount')}</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="authGrid single">
                            <Input label={t('usernameOrEmail')} value={form.identifier} onChange={(identifier) => updateForm({ identifier })} />
                            <Input type="password" label={t('password')} value={form.password} onChange={(password) => updateForm({ password })} />
                        </div>
                    )}
                    {!isRegister && <button className="primary authSubmit" disabled={loading} type="submit"><Lock size={18} />{loading ? t('working') : t('login')}</button>}
                    <button className="ghost authSubmit" onClick={() => navigateTo(setRoute, isRegister ? 'login' : 'register')} type="button">
                        {isRegister ? t('alreadyHaveAccount') : t('createNewAccount')}
                    </button>
                    {error && <div className="error">{error}</div>}
                </form>
            </main>
        </div>
    );
}

function RegisterStep({ step, form, updateForm, t }) {
    if (step === 0) return <div className="authGrid"><Input label={t('firstName')} value={form.firstName} onChange={(firstName) => updateForm({ firstName })} /><Input label={t('lastName')} value={form.lastName} onChange={(lastName) => updateForm({ lastName })} /></div>;
    if (step === 1) return <div className="authGrid single"><Input label={t('username')} value={form.username} onChange={(username) => updateForm({ username })} /></div>;
    if (step === 2) return <div className="authGrid single"><Input label={t('email')} value={form.email} onChange={(email) => updateForm({ email })} /></div>;
    if (step === 3) return <div className="authGrid"><Input label={t('country')} value={form.country} onChange={(country) => updateForm({ country })} /><Input label={t('address')} value={form.address} onChange={(address) => updateForm({ address })} /></div>;
    if (step === 4) return <div className="authGrid"><Input label={t('organization')} value={form.organization} onChange={(organization) => updateForm({ organization })} /><Input label={t('role')} value={form.role} onChange={(role) => updateForm({ role })} /></div>;
    if (step === 5) return <div className="authGrid single"><Input type="password" label={t('password')} value={form.password} onChange={(password) => updateForm({ password })} /></div>;
    return (
        <>
            <div className="confirmSummaryCard">
                <div><span className="eyebrow">Final review</span><strong>Ready to create this workspace account?</strong><small>Check spelling now. You can still go back and edit anything before submitting.</small></div>
                <div className="confirmIdentityBadge"><span>{accountInitials(form)}</span><strong>{registerPayload(form).fullName || 'New account'}</strong><small>{form.email || 'Email required'}</small></div>
            </div>
            <div className="reviewBox">
                {reviewRows(form).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || t('notProvided')}</strong></div>)}
            </div>
            <label className={`confirmRow confirmRowFinal ${form.confirmInfo ? 'checked' : ''}`}>
                <input type="checkbox" checked={form.confirmInfo} onChange={(event) => updateForm({ confirmInfo: event.target.checked })} />
                <span><strong>{t('infoCorrect')}</strong><small>Press Enter or Create account after this is checked.</small></span>
            </label>
        </>
    );
}

function Input({ label, value, onChange, type = 'text' }) {
    return <label className="field"><span>{label}</span><input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ValidationList({ checks }) {
    return <div className="validationList">{checks.map((check) => <div className={check.valid ? 'valid' : ''} key={check.label}><CheckCircle2 size={16} /><span>{check.label}</span></div>)}</div>;
}

function getRegisterSteps(form) {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const username = form.username.trim();
    const email = form.email.trim();
    const country = form.country.trim();
    const address = form.address.trim();
    const organization = form.organization.trim();
    const role = form.role.trim();
    const password = form.password;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const usernameOk = /^[a-zA-Z0-9_-]+$/.test(username);
    const passwordDigits = (password.match(/\d/g) || []).length;
    return [
        { title: 'First name and last name', checks: [{ label: 'First name has at least 2 letters', valid: firstName.length >= 2 }, { label: 'Last name has at least 2 letters', valid: lastName.length >= 2 }] },
        { title: 'Username', checks: [{ label: 'Username is 3 to 80 characters', valid: username.length >= 3 && username.length <= 80 }, { label: 'Only letters, numbers, underscore, or dash', valid: usernameOk }] },
        { title: 'Email address', checks: [{ label: 'Email format is valid', valid: emailOk }, { label: 'Email is under 160 characters', valid: email.length > 0 && email.length <= 160 }] },
        { title: 'Location', checks: [{ label: 'Country is filled in', valid: country.length >= 2 && country.length <= 120 }, { label: 'Address is at least 6 characters', valid: address.length >= 6 && address.length <= 220 }, { label: 'Address includes at least one number', valid: /\d/.test(address) }] },
        { title: 'Work profile', checks: [{ label: 'Organization is 80 characters or less', valid: organization.length <= 80 }, { label: 'Role is 80 characters or less', valid: role.length <= 80 }] },
        { title: 'Password', checks: [{ label: 'Password is at least 8 characters', valid: password.length >= 8 }, { label: 'Password includes at least 1 digit', valid: passwordDigits >= 1 }, { label: 'Password includes at least 1 letter', valid: /[a-zA-Z]/.test(password) }] },
        { title: 'Is all information correct?', checks: [{ label: 'Name, email, location, and password checks are complete', valid: firstName.length >= 2 && lastName.length >= 2 && username.length >= 3 && emailOk && country.length >= 2 && address.length >= 6 && password.length >= 8 && passwordDigits >= 1 }, { label: 'You confirmed the information is correct', valid: form.confirmInfo }] },
    ];
}

function registerPayload(form) {
    return {
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        country: form.country.trim(),
        address: form.address.trim(),
        organization: form.organization.trim(),
        role: form.role.trim(),
        password: form.password,
    };
}

function reviewRows(form) {
    const payload = registerPayload(form);
    return [['Full name', payload.fullName], ['Username', payload.username], ['Email', payload.email], ['Country', payload.country], ['Address', payload.address], ['Organization', payload.organization || 'Independent'], ['Role', payload.role || 'Analyst']];
}

function accountInitials(form) {
    return `${form.firstName.trim().charAt(0)}${form.lastName.trim().charAt(0)}`.toUpperCase() || 'VA';
}

function emptyAuthForm() {
    return { firstName: '', lastName: '', fullName: '', username: '', email: '', country: '', address: '', organization: '', role: '', identifier: '', password: '', confirmInfo: false };
}

function recordAuthTelemetry(action) {
    fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target: 'auth', detail: '', at: new Date().toISOString() }),
    }).catch(() => null);
}
