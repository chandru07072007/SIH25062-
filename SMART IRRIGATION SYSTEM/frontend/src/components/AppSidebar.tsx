import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Sprout, FlaskConical, Banknote, Store } from 'lucide-react';

interface AppSidebarProps {
    userName?: string;
    userRole?: string;
}

const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { to: '/crop-recommendation', label: 'Crop Recommendation', icon: Sprout },
    { to: '/analysis/L-1', label: 'Soil Analysis', icon: FlaskConical },
    { to: '/loans', label: 'Loan Marketplace', icon: Banknote },
    { to: '/marketplace', label: 'Seller Marketplace', icon: Store },
];

const AppSidebar: React.FC<AppSidebarProps> = ({ userName, userRole }) => {
    return (
        <aside className="bg-white border border-gray-200 rounded-2xl p-4 h-fit sticky top-4">
            <div className="flex items-center gap-2 mb-5">
                <div className="h-10 w-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
                    <LayoutGrid size={20} />
                </div>
                <div>
                    <p className="font-bold text-gray-900">AgriMonitor</p>
                    <p className="text-xs text-gray-500">Farmer Console</p>
                </div>
            </div>

            {(userName || userRole) && (
                <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                    <p className="text-sm font-semibold text-emerald-900 truncate">{userName || 'Farmer'}</p>
                    <p className="text-xs text-emerald-700 truncate">{userRole || 'User'}</p>
                </div>
            )}

            <nav className="space-y-2">
                {navItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${isActive ? 'bg-emerald-100 text-emerald-800' : 'text-gray-700 hover:bg-gray-100'
                            }`
                        }
                    >
                        <Icon size={16} />
                        {label}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
};

export default AppSidebar;
