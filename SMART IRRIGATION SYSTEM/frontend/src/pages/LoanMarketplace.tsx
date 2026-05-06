import React, { useEffect, useMemo, useState } from 'react';
import {
    Banknote,
    Search,
    CheckCircle2,
    X,
    Clock3,
    Wallet,
    Building2,
    Landmark,
    Droplets,
    Sun,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import AppSidebar from '../components/AppSidebar';

type LoanType = 'gov' | 'pvt';
type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disbursed';

type FilterChip =
    | 'all'
    | 'government'
    | 'private'
    | 'low_interest'
    | 'no_collateral'
    | 'quick_approval'
    | 'irrigation'
    | 'solar';

type SortMode = 'best_match' | 'interest_asc' | 'amount_desc' | 'approval_asc';

interface LoanScheme {
    scheme_id: string;
    title: string;
    organisation: string;
    type: LoanType;
    description?: string;
    max_amount: number;
    interest_rate?: number | null;
    interest_label?: string | null;
    tenure_max_months: number;
    approval_days?: number | null;
    collateral_required: boolean;
    min_land_acres?: number | null;
    badge?: string | null;
    soil_types_eligible?: string[];
    tags?: string[];
    documents?: { doc_label: string; is_mandatory: boolean }[];
    steps?: { step_order: number; step_label: string }[];
    match_score?: number;
    reasons?: string[];
}

interface LoanMatchResponse {
    matches: Array<{
        scheme_id: string;
        match_score: number;
        reasons: string[];
    }>;
}

interface LoanApplicationsResponse {
    applications: LoanApplication[];
}

interface LoanApplication {
    application_id: string;
    farmer_id: string;
    scheme_id: string;
    land_id?: string | null;
    status: ApplicationStatus;
    amount_requested: number;
    applied_at: string;
    scheme?: {
        title?: string;
        organisation?: string;
        type?: LoanType;
        interest_label?: string;
    };
}

interface ToastState {
    open: boolean;
    type: 'success' | 'error';
    message: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const LoanMarketplace: React.FC = () => {
    const navigate = useNavigate();
    useLanguage();
    const { currentUser } = useUser();

    const [tab, setTab] = useState<'browse' | 'applications'>('browse');
    const [loading, setLoading] = useState(true);
    const [appLoading, setAppLoading] = useState(false);
    const [schemes, setSchemes] = useState<LoanScheme[]>([]);
    const [applications, setApplications] = useState<LoanApplication[]>([]);
    const [selectedScheme, setSelectedScheme] = useState<LoanScheme | null>(null);
    const [search, setSearch] = useState('');
    const [sortMode, setSortMode] = useState<SortMode>('best_match');
    const [chip, setChip] = useState<FilterChip>('all');
    const [toast, setToast] = useState<ToastState>({ open: false, type: 'success', message: '' });

    const farmerId = useMemo(() => {
        if (!currentUser) return null;
        const anyUser = currentUser as unknown as { id?: string };
        return typeof anyUser.id === 'string' ? anyUser.id : null;
    }, [currentUser]);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ open: true, type, message });
        window.setTimeout(() => {
            setToast((prev) => ({ ...prev, open: false }));
        }, 2600);
    };

    const fetchSchemesAndMatches = async () => {
        setLoading(true);
        try {
            const baseRes = await fetch(`${API_BASE}/loans/schemes`);
            if (!baseRes.ok) {
                throw new Error('Failed to fetch schemes');
            }
            const baseJson = await baseRes.json();
            const baseSchemes: LoanScheme[] = baseJson.schemes || [];

            if (!farmerId) {
                const anonymous = baseSchemes.map((s) => ({ ...s, match_score: 50, reasons: [] }));
                setSchemes(anonymous);
                return;
            }

            const matchRes = await fetch(`${API_BASE}/loans/match/${farmerId}`);
            if (!matchRes.ok) {
                setSchemes(baseSchemes);
                return;
            }

            const matchJson: LoanMatchResponse = await matchRes.json();
            const matchMap = new Map<string, { score: number; reasons: string[] }>();
            (matchJson.matches || []).forEach((m) => {
                matchMap.set(m.scheme_id, { score: m.match_score, reasons: m.reasons || [] });
            });

            const merged = baseSchemes.map((s) => ({
                ...s,
                match_score: matchMap.get(s.scheme_id)?.score ?? 45,
                reasons: matchMap.get(s.scheme_id)?.reasons ?? [],
            }));
            setSchemes(merged);
        } catch (error) {
            console.error('Error loading schemes:', error);
            showToast('error', 'Unable to load schemes');
        } finally {
            setLoading(false);
        }
    };

    const fetchApplications = async () => {
        if (!farmerId) {
            setApplications([]);
            return;
        }

        setAppLoading(true);
        try {
            const res = await fetch(`${API_BASE}/loans/applications/${farmerId}`);
            if (!res.ok) throw new Error('Failed to fetch applications');
            const json: LoanApplicationsResponse = await res.json();
            setApplications((json.applications || (json as unknown as LoanApplication[])) || []);
        } catch (error) {
            console.error('Error loading applications:', error);
            showToast('error', 'Unable to load applications');
        } finally {
            setAppLoading(false);
        }
    };

    useEffect(() => {
        fetchSchemesAndMatches();
        fetchApplications();
    }, [farmerId]);

    const statusColor = (status: ApplicationStatus) => {
        if (status === 'submitted') return 'bg-blue-100 text-blue-700';
        if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
        if (status === 'rejected') return 'bg-red-100 text-red-700';
        if (status === 'under_review') return 'bg-yellow-100 text-yellow-700';
        if (status === 'disbursed') return 'bg-purple-100 text-purple-700';
        return 'bg-slate-100 text-slate-700';
    };

    const alreadyApplied = (schemeId: string) => applications.some((a) => a.scheme_id === schemeId);

    const filteredSchemes = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        const afterSearch = schemes.filter((scheme) => {
            const hay = `${scheme.title} ${scheme.organisation} ${scheme.description || ''}`.toLowerCase();
            if (!normalizedSearch) return true;
            return hay.includes(normalizedSearch);
        });

        const chipFiltered = afterSearch.filter((scheme) => {
            const text = `${scheme.title} ${scheme.organisation} ${scheme.description || ''} ${(scheme.tags || []).join(' ')}`.toLowerCase();
            if (chip === 'all') return true;
            if (chip === 'government') return scheme.type === 'gov';
            if (chip === 'private') return scheme.type === 'pvt';
            if (chip === 'low_interest') return (scheme.interest_rate ?? 999) <= 5;
            if (chip === 'no_collateral') return scheme.collateral_required === false;
            if (chip === 'quick_approval') return (scheme.approval_days ?? 999) <= 7;
            if (chip === 'irrigation') return text.includes('irrigation') || text.includes('drip') || text.includes('water');
            if (chip === 'solar') return text.includes('solar') || text.includes('kusum');
            return true;
        });

        const sorted = [...chipFiltered];
        if (sortMode === 'best_match') sorted.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        if (sortMode === 'interest_asc') sorted.sort((a, b) => (a.interest_rate ?? 999) - (b.interest_rate ?? 999));
        if (sortMode === 'amount_desc') sorted.sort((a, b) => (b.max_amount || 0) - (a.max_amount || 0));
        if (sortMode === 'approval_asc') sorted.sort((a, b) => (a.approval_days ?? 999) - (b.approval_days ?? 999));

        return sorted;
    }, [schemes, search, chip, sortMode]);

    const stats = useMemo(() => {
        const total = schemes.length;
        const rates = schemes.map((s) => s.interest_rate).filter((v): v is number => typeof v === 'number');
        const lowestRate = rates.length ? Math.min(...rates) : 0;
        const maxLoan = schemes.length ? Math.max(...schemes.map((s) => s.max_amount || 0)) : 0;
        const quickApprovals = schemes.filter((s) => (s.approval_days ?? 999) <= 7).length;
        return { total, lowestRate, maxLoan, quickApprovals };
    }, [schemes]);

    const matchDots = (score: number) => {
        const filled = Math.max(1, Math.min(5, Math.round(score / 20)));
        return (
            <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, idx) => (
                    <span
                        key={idx}
                        className={`h-2.5 w-2.5 rounded-full ${idx < filled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    />
                ))}
            </div>
        );
    };

    const handleApply = async (scheme: LoanScheme) => {
        if (!farmerId) {
            showToast('error', 'Please login as a farmer to apply');
            return;
        }

        if (alreadyApplied(scheme.scheme_id)) {
            showToast('error', 'You have already applied for this scheme');
            return;
        }

        try {
            const amountRequested = Math.max(10000, Math.floor((scheme.max_amount || 0) * 0.5));
            const res = await fetch(`${API_BASE}/loans/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    farmer_id: farmerId,
                    scheme_id: scheme.scheme_id,
                    land_id: null,
                    amount_requested: amountRequested,
                }),
            });

            const payload = await res.json();
            if (!res.ok) {
                throw new Error(payload?.detail || 'Application failed');
            }

            showToast('success', 'Loan application submitted successfully');
            await fetchApplications();
        } catch (error) {
            showToast('error', error instanceof Error ? error.message : 'Application failed');
        }
    };

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center max-w-md">
                    <p className="text-lg font-semibold text-gray-800 mb-2">Please login to continue</p>
                    <button
                        onClick={() => navigate('/')}
                        className="mt-2 px-4 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-600"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            {toast.open && (
                <div className="fixed top-5 right-5 z-50">
                    <div
                        className={`px-4 py-3 rounded-xl shadow-lg text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
                            }`}
                    >
                        {toast.message}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
                <AppSidebar userName={currentUser.name} userRole={currentUser.role} />

                <main>
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Loan Marketplace</h1>
                                <p className="text-sm text-gray-500">Farmer-focused finance and government schemes</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setTab('browse')}
                                    className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === 'browse' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    Browse Schemes
                                </button>
                                <button
                                    onClick={() => {
                                        setTab('applications');
                                        fetchApplications();
                                    }}
                                    className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === 'applications' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    My Applications
                                </button>
                            </div>
                        </div>

                        {tab === 'browse' && (
                            <>
                                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
                                    <div className="rounded-xl border border-gray-200 p-3">
                                        <p className="text-xs text-gray-500">Total Schemes</p>
                                        <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                                    </div>
                                    <div className="rounded-xl border border-gray-200 p-3">
                                        <p className="text-xs text-gray-500">Lowest Rate</p>
                                        <p className="text-xl font-bold text-gray-900">{stats.lowestRate ? `${stats.lowestRate}%` : '--'}</p>
                                    </div>
                                    <div className="rounded-xl border border-gray-200 p-3">
                                        <p className="text-xs text-gray-500">Max Loan</p>
                                        <p className="text-xl font-bold text-gray-900">{stats.maxLoan ? INR.format(stats.maxLoan) : '--'}</p>
                                    </div>
                                    <div className="rounded-xl border border-gray-200 p-3">
                                        <p className="text-xs text-gray-500">Quick Approvals</p>
                                        <p className="text-xl font-bold text-gray-900">{stats.quickApprovals}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3 mb-4">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search by title, organisation, purpose..."
                                            className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <select
                                        value={sortMode}
                                        onChange={(e) => setSortMode(e.target.value as SortMode)}
                                        className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="best_match">Best Match</option>
                                        <option value="interest_asc">Interest Low-High</option>
                                        <option value="amount_desc">Amount High-Low</option>
                                        <option value="approval_asc">Fastest Approval</option>
                                    </select>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-5">
                                    {[
                                        { key: 'all', label: 'All' },
                                        { key: 'government', label: 'Government', icon: <Landmark size={14} /> },
                                        { key: 'private', label: 'Private Banks', icon: <Building2 size={14} /> },
                                        { key: 'low_interest', label: 'Low Interest', icon: <Wallet size={14} /> },
                                        { key: 'no_collateral', label: 'No Collateral' },
                                        { key: 'quick_approval', label: 'Quick Approval', icon: <Clock3 size={14} /> },
                                        { key: 'irrigation', label: 'Irrigation', icon: <Droplets size={14} /> },
                                        { key: 'solar', label: 'Solar', icon: <Sun size={14} /> },
                                    ].map((item) => (
                                        <button
                                            key={item.key}
                                            onClick={() => setChip(item.key as FilterChip)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${chip === item.key
                                                ? 'bg-emerald-700 text-white border-emerald-700'
                                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {item.icon}
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                {loading ? (
                                    <div className="py-16 text-center text-gray-500">Loading schemes...</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {filteredSchemes.map((scheme) => {
                                            const isApplied = alreadyApplied(scheme.scheme_id);
                                            const hot = (scheme.approval_days ?? 999) <= 3;
                                            const isNew = !hot && (scheme.approval_days ?? 999) <= 7;

                                            return (
                                                <div key={scheme.scheme_id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <div className="h-11 w-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                                            <Banknote size={20} />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${scheme.type === 'gov' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {scheme.type === 'gov' ? 'GOV' : 'PVT'}
                                                            </span>
                                                            {hot && <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-red-100 text-red-700">HOT</span>}
                                                            {isNew && <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-amber-100 text-amber-700">NEW</span>}
                                                        </div>
                                                    </div>

                                                    <h3 className="font-bold text-gray-900 leading-tight mb-1">{scheme.title}</h3>
                                                    <p className="text-xs text-gray-500 mb-3">{scheme.organisation}</p>

                                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                                        <div className="rounded-lg bg-gray-50 p-2">
                                                            <p className="text-gray-500">Max Amount</p>
                                                            <p className="font-semibold text-gray-900">{INR.format(scheme.max_amount)}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-gray-50 p-2">
                                                            <p className="text-gray-500">Interest</p>
                                                            <p className="font-semibold text-gray-900">{scheme.interest_label || '--'}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-gray-50 p-2">
                                                            <p className="text-gray-500">Tenure</p>
                                                            <p className="font-semibold text-gray-900">{scheme.tenure_max_months} months</p>
                                                        </div>
                                                        <div className="rounded-lg bg-gray-50 p-2">
                                                            <p className="text-gray-500">Approval</p>
                                                            <p className="font-semibold text-gray-900">{scheme.approval_days ?? '--'} days</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between mb-3">
                                                        {scheme.collateral_required ? (
                                                            <span className="text-[11px] px-2 py-1 rounded-full bg-rose-100 text-rose-700">Collateral Required</span>
                                                        ) : (
                                                            <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">No Collateral</span>
                                                        )}
                                                        <div title={`Match: ${scheme.match_score || 0}%`}>{matchDots(scheme.match_score || 0)}</div>
                                                    </div>

                                                    <button
                                                        onClick={() => setSelectedScheme(scheme)}
                                                        className="w-full py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-600"
                                                    >
                                                        View & Apply
                                                    </button>

                                                    {isApplied && (
                                                        <div className="mt-2 text-center text-[11px] font-bold text-blue-700 bg-blue-100 rounded-lg py-1">
                                                            Already Applied
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {selectedScheme && (
                                    <div className="w-full mt-6 rounded-2xl bg-black/30 p-3 md:p-4">
                                        <div className="w-full bg-white rounded-2xl border border-gray-200 p-5">
                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                <div>
                                                    <h2 className="text-2xl font-bold text-gray-900">{selectedScheme.title}</h2>
                                                    <p className="text-sm text-gray-500">{selectedScheme.organisation}</p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedScheme(null)}
                                                    className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            <p className="text-sm text-gray-700 mb-4">
                                                {selectedScheme.description || 'No additional description available for this scheme.'}
                                            </p>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                                                <div className="rounded-xl bg-gray-50 p-3">
                                                    <p className="text-xs text-gray-500">Amount</p>
                                                    <p className="font-bold text-gray-900">{INR.format(selectedScheme.max_amount)}</p>
                                                </div>
                                                <div className="rounded-xl bg-gray-50 p-3">
                                                    <p className="text-xs text-gray-500">Rate</p>
                                                    <p className="font-bold text-gray-900">{selectedScheme.interest_label || '--'}</p>
                                                </div>
                                                <div className="rounded-xl bg-gray-50 p-3">
                                                    <p className="text-xs text-gray-500">Tenure</p>
                                                    <p className="font-bold text-gray-900">{selectedScheme.tenure_max_months} months</p>
                                                </div>
                                                <div className="rounded-xl bg-gray-50 p-3">
                                                    <p className="text-xs text-gray-500">Approval</p>
                                                    <p className="font-bold text-gray-900">{selectedScheme.approval_days ?? '--'} days</p>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <h3 className="font-bold text-gray-900 mb-2">Required Documents</h3>
                                                {(selectedScheme.documents || []).length === 0 ? (
                                                    <p className="text-sm text-gray-500">Document list not available.</p>
                                                ) : (
                                                    <div className="grid md:grid-cols-2 gap-2">
                                                        {(selectedScheme.documents || []).map((doc) => (
                                                            <div key={doc.doc_label} className="flex items-center gap-2 text-sm text-gray-700">
                                                                <CheckCircle2 size={16} className="text-emerald-600" />
                                                                <span>{doc.doc_label}</span>
                                                                {doc.is_mandatory && <span className="text-xs text-red-600">(Mandatory)</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mb-5">
                                                <h3 className="font-bold text-gray-900 mb-2">Application Steps</h3>
                                                {(selectedScheme.steps || []).length === 0 ? (
                                                    <p className="text-sm text-gray-500">Step details not available.</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {(selectedScheme.steps || [])
                                                            .slice()
                                                            .sort((a, b) => a.step_order - b.step_order)
                                                            .map((step) => (
                                                                <div key={step.step_order} className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs">
                                                                    <span className="h-5 w-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold">
                                                                        {step.step_order}
                                                                    </span>
                                                                    <span className="text-gray-700">{step.step_label}</span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between gap-3">
                                                {alreadyApplied(selectedScheme.scheme_id) ? (
                                                    <span className="px-3 py-2 rounded-lg text-sm font-bold bg-blue-100 text-blue-700">Already Applied</span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleApply(selectedScheme)}
                                                        className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-600"
                                                    >
                                                        Apply for this loan
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSelectedScheme(null)}
                                                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {tab === 'applications' && (
                            <div className="space-y-3">
                                {appLoading ? (
                                    <div className="py-16 text-center text-gray-500">Loading applications...</div>
                                ) : applications.length === 0 ? (
                                    <div className="py-16 text-center text-gray-500">No loan applications found</div>
                                ) : (
                                    applications.map((app) => (
                                        <div key={app.application_id} className="border border-gray-200 rounded-xl p-4 bg-white">
                                            <div className="flex flex-wrap justify-between gap-3">
                                                <div>
                                                    <p className="font-bold text-gray-900">{app.scheme?.title || `Scheme #${app.scheme_id}`}</p>
                                                    <p className="text-sm text-gray-500">{app.scheme?.organisation || 'Organisation not available'}</p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Applied: {new Date(app.applied_at).toLocaleDateString('en-IN')}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">{INR.format(app.amount_requested || 0)}</p>
                                                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${statusColor(app.status)}`}>
                                                        {app.status.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default LoanMarketplace;
