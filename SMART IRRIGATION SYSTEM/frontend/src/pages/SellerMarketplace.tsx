import React, { useEffect, useMemo, useState } from 'react';
import {
    ShoppingCart,
    Store,
    Users,
    Package,
    Heart,
    Search,
    X,
    Plus,
    Minus,
    MapPin,
    Leaf,
    Clock3,
    Star,
    Truck,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import AppSidebar from '../components/AppSidebar';

type FilterChip = 'all' | 'vegetable' | 'grain' | 'fruit' | 'spice' | 'organic' | 'fresh';
type SortOption = 'best_match' | 'price_asc' | 'price_desc' | 'fresh';
type OrderStatus = 'pending' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
type TabKey = 'browse' | 'farmers' | 'cart' | 'orders';

interface Product {
    product_id: string;
    farmer_id: string;
    land_id?: string | null;
    crop_name: string;
    category: 'vegetable' | 'grain' | 'fruit' | 'spice' | 'other';
    price_per_unit: number;
    unit: 'kg' | 'piece' | 'bunch';
    stock_quantity: number;
    min_order_qty: number;
    bulk_discount_pct: number;
    bulk_trigger_multiplier: number;
    is_organic: boolean;
    is_freshly_harvested: boolean;
    description?: string;
    image_url?: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    freshness_score?: number;
    farmer?: {
        name?: string;
        location?: string;
        village?: string;
    };
    land?: {
        soil_type?: string;
    };
}

interface ProductDetail extends Product {
    avg_rating?: number;
    review_count?: number;
    soil_analysis?: {
        nitrogen?: number;
        phosphorus?: number;
        potassium?: number;
        ph_level?: number;
    };
    reviews?: Array<{
        rating: number;
        comment?: string;
        created_at?: string;
    }>;
}

interface FarmerCard {
    farmer_id: string;
    name: string;
    village: string;
    area_acres: number;
    crops: string[];
    avg_rating: number;
    total_orders_fulfilled: number;
    is_certified: boolean;
}

interface CartItem {
    cart_item_id: string;
    product_id: string;
    quantity: number;
    product: Product;
    line_total: number;
    discount_amount: number;
}

interface CartResponse {
    seller_id: string;
    items: CartItem[];
    summary: {
        subtotal: number;
        total_discount: number;
        grand_total: number;
    };
}

interface OrderItem {
    crop_name: string;
    quantity: number;
    unit: string;
}

interface SellerOrder {
    order_id: string;
    status: OrderStatus;
    total_amount: number;
    ordered_at: string;
    farmers: string[];
    items: OrderItem[];
}

interface ToastState {
    open: boolean;
    type: 'success' | 'error';
    message: string;
}

interface CartAddPayload {
    seller_id: string;
    product_id: string;
    quantity: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

const cropMeta: Record<string, { emoji: string; tone: string }> = {
    tomato: { emoji: '🍅', tone: 'from-red-100 to-rose-50 text-red-700' },
    turmeric: { emoji: '🟡', tone: 'from-yellow-100 to-amber-50 text-yellow-700' },
    rice: { emoji: '🌾', tone: 'from-amber-100 to-yellow-50 text-amber-700' },
    banana: { emoji: '🍌', tone: 'from-yellow-100 to-lime-50 text-yellow-700' },
    brinjal: { emoji: '🍆', tone: 'from-violet-100 to-purple-50 text-violet-700' },
    chilli: { emoji: '🌶️', tone: 'from-rose-100 to-red-50 text-rose-700' },
    groundnut: { emoji: '🥜', tone: 'from-orange-100 to-amber-50 text-orange-700' },
    mango: { emoji: '🥭', tone: 'from-amber-100 to-orange-50 text-amber-700' },
    toor: { emoji: '🫘', tone: 'from-lime-100 to-green-50 text-lime-700' },
    drumstick: { emoji: '🥬', tone: 'from-emerald-100 to-green-50 text-emerald-700' },
    coconut: { emoji: '🥥', tone: 'from-zinc-100 to-stone-50 text-stone-700' },
    coriander: { emoji: '🌿', tone: 'from-green-100 to-emerald-50 text-green-700' },
};

const SellerMarketplace: React.FC = () => {
    useLanguage();
    const { currentUser } = useUser();

    const [activeTab, setActiveTab] = useState<TabKey>('browse');

    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingFarmers, setLoadingFarmers] = useState(false);
    const [loadingCart, setLoadingCart] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const [products, setProducts] = useState<Product[]>([]);
    const [farmers, setFarmers] = useState<FarmerCard[]>([]);
    const [cart, setCart] = useState<CartResponse | null>(null);
    const [orders, setOrders] = useState<SellerOrder[]>([]);

    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('best_match');
    const [chip, setChip] = useState<FilterChip>('all');
    const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);

    const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
    const [productDetailLoading, setProductDetailLoading] = useState(false);
    const [modalQty, setModalQty] = useState(0);

    const [wishlist, setWishlist] = useState<Set<string>>(new Set());
    const [placingOrder, setPlacingOrder] = useState(false);

    const [toast, setToast] = useState<ToastState>({ open: false, type: 'success', message: '' });

    const sellerId = useMemo(() => {
        if (!currentUser) return null;
        const user = currentUser as unknown as { seller_id?: string; id?: string };
        if (user.seller_id) return user.seller_id;
        if (user.id) return user.id;
        return null;
    }, [currentUser]);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ open: true, type, message });
        window.setTimeout(() => {
            setToast((prev) => ({ ...prev, open: false }));
        }, 2500);
    };

    const sendPrompt = (prompt: string) => {
        const url = `https://wa.me/?text=${encodeURIComponent(prompt)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const getCropMeta = (cropName?: string) => {
        const key = (cropName || '').toLowerCase();
        const found = Object.keys(cropMeta).find((k) => key.includes(k));
        return found ? cropMeta[found] : { emoji: '🧺', tone: 'from-slate-100 to-gray-50 text-slate-700' };
    };

    const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
            const query = new URLSearchParams();
            if (chip === 'vegetable' || chip === 'grain' || chip === 'fruit' || chip === 'spice') {
                query.set('category', chip);
            }
            if (chip === 'organic') {
                query.set('is_organic', 'true');
            }
            if (chip === 'fresh') {
                query.set('is_fresh', 'true');
            }
            if (search.trim()) {
                query.set('search', search.trim());
            }
            if (sortBy === 'price_asc' || sortBy === 'price_desc') {
                query.set('sort_by', sortBy);
            }
            if (sortBy === 'fresh') {
                query.set('sort_by', 'newest');
            }

            const url = `${API_BASE}/market/products${query.toString() ? `?${query.toString()}` : ''}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error('Failed to fetch products');
            }
            const data = await res.json();
            const rawRows: any[] = Array.isArray(data) ? data : data.products || [];
            const incoming: Product[] = rawRows.map((row) => ({
                product_id: row.product_id || row._id,
                farmer_id: String(row.farmer_id || ''),
                land_id: row.land_id ? String(row.land_id) : null,
                crop_name: row.crop_name || row.crop?.crop_name || 'Unknown Crop',
                category: row.category || 'other',
                price_per_unit: Number(row.price_per_unit || 0),
                unit: row.unit || 'kg',
                stock_quantity: Number(row.stock_quantity ?? row.quantity_available ?? 0),
                min_order_qty: Number(row.min_order_qty ?? 1),
                bulk_discount_pct: Number(row.bulk_discount_pct ?? 0),
                bulk_trigger_multiplier: Number(row.bulk_trigger_multiplier ?? 3),
                is_organic: Boolean(row.is_organic),
                is_freshly_harvested: Boolean(row.is_freshly_harvested),
                description: row.description,
                image_url: row.image_url || row.crop?.image_url,
                is_active: row.is_active ?? row.status === 'active',
                created_at: row.created_at,
                updated_at: row.updated_at,
                freshness_score: Number(row.freshness_score ?? 0),
                farmer: {
                    name: row.farmer?.name,
                    village: row.farmer?.village || row.farmer?.location,
                    location: row.farmer?.location,
                },
                land: row.land,
            }));
            setProducts(incoming);
        } catch (error) {
            console.error(error);
            showToast('error', 'Unable to load marketplace products');
        } finally {
            setLoadingProducts(false);
        }
    };

    const fetchFarmers = async () => {
        setLoadingFarmers(true);
        try {
            const res = await fetch(`${API_BASE}/market/farmers`);
            if (!res.ok) {
                throw new Error('Failed to fetch farmers');
            }
            const data = await res.json();
            const incoming: FarmerCard[] = Array.isArray(data) ? data : data.farmers || [];
            setFarmers(incoming);
        } catch (error) {
            console.error(error);
            showToast('error', 'Unable to load farmers');
        } finally {
            setLoadingFarmers(false);
        }
    };

    const fetchCart = async () => {
        if (!sellerId) return;
        setLoadingCart(true);
        try {
            const res = await fetch(`${API_BASE}/market/cart/${sellerId}`);
            if (!res.ok) {
                throw new Error('Failed to fetch cart');
            }
            const data: CartResponse = await res.json();
            setCart(data);
        } catch (error) {
            console.error(error);
            showToast('error', 'Unable to load cart');
        } finally {
            setLoadingCart(false);
        }
    };

    const fetchOrders = async () => {
        if (!sellerId) return;
        setLoadingOrders(true);
        try {
            const res = await fetch(`${API_BASE}/market/orders/${sellerId}`);
            if (!res.ok) {
                throw new Error('Failed to fetch orders');
            }
            const data = await res.json();
            const incoming: SellerOrder[] = Array.isArray(data) ? data : data.orders || [];
            setOrders(incoming);
        } catch (error) {
            console.error(error);
            showToast('error', 'Unable to load orders');
        } finally {
            setLoadingOrders(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [chip, sortBy]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            fetchProducts();
        }, 220);
        return () => window.clearTimeout(timeout);
    }, [search]);

    useEffect(() => {
        fetchFarmers();
    }, []);

    useEffect(() => {
        if (!sellerId) return;
        if (activeTab === 'cart') {
            fetchCart();
        }
        if (activeTab === 'orders') {
            fetchOrders();
        }
    }, [activeTab, sellerId]);

    const filteredProducts = useMemo(() => {
        let rows = [...products];

        if (selectedFarmerId !== null) {
            rows = rows.filter((p) => p.farmer_id === selectedFarmerId);
        }

        if (sortBy === 'price_asc') {
            rows.sort((a, b) => a.price_per_unit - b.price_per_unit);
        } else if (sortBy === 'price_desc') {
            rows.sort((a, b) => b.price_per_unit - a.price_per_unit);
        } else if (sortBy === 'fresh') {
            rows.sort((a, b) => {
                const freshDiff = Number(b.is_freshly_harvested) - Number(a.is_freshly_harvested);
                if (freshDiff !== 0) return freshDiff;
                return (b.freshness_score || 0) - (a.freshness_score || 0);
            });
        } else {
            rows.sort((a, b) => {
                const scoreA = (a.freshness_score || 0) + Number(a.is_organic) * 0.1;
                const scoreB = (b.freshness_score || 0) + Number(b.is_organic) * 0.1;
                return scoreB - scoreA;
            });
        }

        return rows;
    }, [products, selectedFarmerId, sortBy]);

    const stats = useMemo(() => {
        const totalProducts = filteredProducts.length;
        const farmersSet = new Set(filteredProducts.map((p) => p.farmer_id));
        const villagesSet = new Set(
            filteredProducts.map((p) => p.farmer?.village || '').filter((v) => v)
        );
        const organicCount = filteredProducts.filter((p) => p.is_organic).length;

        return {
            totalProducts,
            farmersCount: farmersSet.size,
            villagesCount: villagesSet.size,
            organicCount,
        };
    }, [filteredProducts]);

    const openProduct = async (product: Product) => {
        setProductDetailLoading(true);
        setSelectedProduct(null);
        try {
            const res = await fetch(`${API_BASE}/market/products/${product.product_id}`);
            if (!res.ok) {
                throw new Error('Failed to load product detail');
            }
            const data: ProductDetail = await res.json();
            setSelectedProduct(data);
            const startQty = Math.max(data.min_order_qty || 1, 1);
            setModalQty(startQty);
        } catch (error) {
            console.error(error);
            showToast('error', 'Unable to load product details');
        } finally {
            setProductDetailLoading(false);
        }
    };

    const toggleWishlist = (productId: string) => {
        setWishlist((prev) => {
            const next = new Set(prev);
            if (next.has(productId)) {
                next.delete(productId);
            } else {
                next.add(productId);
            }
            return next;
        });
    };

    const addToCart = async (payload: CartAddPayload) => {
        try {
            const res = await fetch(`${API_BASE}/market/cart/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.detail || 'Failed to add to cart');
            }
            showToast('success', 'Added to cart');
            if (activeTab === 'cart') {
                fetchCart();
            }
        } catch (error) {
            showToast('error', error instanceof Error ? error.message : 'Failed to add to cart');
        }
    };

    const removeFromCart = async (productId: string) => {
        if (!sellerId) return;
        try {
            const res = await fetch(`${API_BASE}/market/cart/${sellerId}/${productId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data?.detail || 'Failed to remove item');
            }
            showToast('success', 'Removed from cart');
            fetchCart();
        } catch (error) {
            showToast('error', error instanceof Error ? error.message : 'Failed to remove item');
        }
    };

    const placeOrder = async () => {
        if (!sellerId) return;
        if (!cart || !cart.items.length) {
            showToast('error', 'Cart is empty');
            return;
        }

        setPlacingOrder(true);
        try {
            const res = await fetch(`${API_BASE}/market/orders/place`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seller_id: sellerId,
                    delivery_address: 'Default Address',
                    notes: 'Order placed via Seller Marketplace',
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.detail || 'Failed to place order');
            }

            showToast('success', `Order ${data?.order_id || ''} placed successfully`);
            await fetchCart();
            await fetchOrders();
            setActiveTab('orders');
        } catch (error) {
            showToast('error', error instanceof Error ? error.message : 'Order placement failed');
        } finally {
            setPlacingOrder(false);
        }
    };

    const modalCalc = useMemo(() => {
        if (!selectedProduct) {
            return { baseTotal: 0, discount: 0, finalTotal: 0, discountEligible: false };
        }

        const qty = modalQty || 0;
        const baseTotal = qty * selectedProduct.price_per_unit;
        const threshold = selectedProduct.min_order_qty * selectedProduct.bulk_trigger_multiplier;
        const discountEligible = qty >= threshold;
        const discount = discountEligible ? (baseTotal * (selectedProduct.bulk_discount_pct || 0)) / 100 : 0;
        const finalTotal = baseTotal - discount;

        return { baseTotal, discount, finalTotal, discountEligible };
    }, [selectedProduct, modalQty]);

    const statusClasses = (status: OrderStatus) => {
        if (status === 'pending') return 'bg-gray-100 text-gray-700';
        if (status === 'packed') return 'bg-amber-100 text-amber-700';
        if (status === 'shipped') return 'bg-blue-100 text-blue-700';
        if (status === 'delivered') return 'bg-green-100 text-green-700';
        return 'bg-red-100 text-red-700';
    };

    if (!sellerId) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
                    <Store className="mx-auto mb-3 text-slate-500" size={30} />
                    <h2 className="text-xl font-bold text-slate-800">Seller login required</h2>
                    <p className="mt-2 text-sm text-slate-600">Please sign in as a seller profile to use the marketplace.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            {toast.open && (
                <div className="fixed right-5 top-5 z-50">
                    <div
                        className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
                            }`}
                    >
                        {toast.message}
                    </div>
                </div>
            )}

            <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-4">
                <AppSidebar
                    userName={currentUser?.name ?? ''}
                    userRole={currentUser?.role ?? ''}
                />

                <main className="space-y-4">
                    <section className="rounded-2xl bg-white border border-slate-200 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900">FarmDirect Seller Marketplace</h1>
                                <p className="text-sm text-slate-600 mt-1">Buy fresh produce directly from verified farmers.</p>
                            </div>
                            <div className="inline-flex rounded-xl bg-slate-100 p-1">
                                {[
                                    { key: 'browse', label: 'Browse Produce', icon: Store },
                                    { key: 'farmers', label: 'Farmers', icon: Users },
                                    { key: 'cart', label: 'My Cart', icon: ShoppingCart },
                                    { key: 'orders', label: 'My Orders', icon: Package },
                                ].map(({ key, label, icon: Icon }) => (
                                    <button
                                        key={key}
                                        onClick={() => setActiveTab(key as TabKey)}
                                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${activeTab === key
                                            ? 'bg-white text-emerald-700 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                    >
                                        <Icon size={16} />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {activeTab === 'browse' && (
                        <section className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs text-slate-500">Total Products</p>
                                    <p className="text-xl font-black text-slate-900 mt-1">{stats.totalProducts}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs text-slate-500">Farmers</p>
                                    <p className="text-xl font-black text-slate-900 mt-1">{stats.farmersCount}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs text-slate-500">Villages</p>
                                    <p className="text-xl font-black text-slate-900 mt-1">{stats.villagesCount}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs text-slate-500">Organic Produce</p>
                                    <p className="text-xl font-black text-slate-900 mt-1">{stats.organicCount}</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-[1fr,220px] gap-3">
                                    <label className="relative block">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search crop, farmer or village"
                                            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                                        />
                                    </label>

                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                                    >
                                        <option value="best_match">Best Match</option>
                                        <option value="price_asc">Price Low-High</option>
                                        <option value="price_desc">Price High-Low</option>
                                        <option value="fresh">Freshly Harvested</option>
                                    </select>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { key: 'all', label: 'All' },
                                        { key: 'vegetable', label: 'Vegetables' },
                                        { key: 'grain', label: 'Grains & Pulses' },
                                        { key: 'fruit', label: 'Fruits' },
                                        { key: 'spice', label: 'Spices' },
                                        { key: 'organic', label: 'Organic' },
                                        { key: 'fresh', label: 'Fresh Today' },
                                    ].map((f) => (
                                        <button
                                            key={f.key}
                                            onClick={() => setChip(f.key as FilterChip)}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${chip === f.key
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                {selectedFarmerId !== null && (
                                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800 inline-flex items-center gap-2">
                                        Showing products from selected farmer
                                        <button
                                            onClick={() => setSelectedFarmerId(null)}
                                            className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-emerald-700 border border-emerald-200"
                                        >
                                            <X size={12} />
                                            Clear
                                        </button>
                                    </div>
                                )}
                            </div>

                            {loadingProducts ? (
                                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading products...</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredProducts.map((product) => {
                                        const meta = getCropMeta(product.crop_name);
                                        const stockPct = Math.max(3, Math.min(100, (product.stock_quantity / Math.max(product.stock_quantity, 1)) * 100));
                                        const lowStock = product.stock_quantity <= product.min_order_qty * 2;

                                        return (
                                            <article
                                                key={product.product_id}
                                                className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition"
                                            >
                                                <button
                                                    onClick={() => openProduct(product)}
                                                    className={`w-full bg-gradient-to-r ${meta.tone} px-4 py-3 text-left`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-2xl">{meta.emoji}</p>
                                                        <span className="text-xs font-semibold uppercase tracking-wide">{product.category}</span>
                                                    </div>
                                                    <h3 className="mt-2 text-lg font-black text-slate-900">{product.crop_name}</h3>
                                                    <p className="text-xs text-slate-700 mt-1 inline-flex items-center gap-1">
                                                        <MapPin size={12} />
                                                        {(product.farmer?.name || 'Farmer')} · {(product.farmer?.village || 'Village')}
                                                    </p>
                                                </button>

                                                <div className="p-4 space-y-3">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {product.is_organic && (
                                                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">Organic</span>
                                                        )}
                                                        {product.is_freshly_harvested && (
                                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Fresh</span>
                                                        )}
                                                        {lowStock && (
                                                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Low Stock</span>
                                                        )}
                                                        {product.bulk_discount_pct > 0 && (
                                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{product.bulk_discount_pct}% Bulk Discount</span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-end justify-between">
                                                        <p className="text-lg font-black text-slate-900">{INR.format(product.price_per_unit)} <span className="text-sm font-semibold text-slate-500">/ {product.unit}</span></p>
                                                        <p className="text-xs text-slate-500">Min: {product.min_order_qty} {product.unit}</p>
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                                            <span>Stock</span>
                                                            <span>{product.stock_quantity} {product.unit}</span>
                                                        </div>
                                                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full bg-emerald-500"
                                                                style={{ width: `${stockPct}%` }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => addToCart({ seller_id: sellerId, product_id: product.product_id, quantity: product.min_order_qty })}
                                                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                                                        >
                                                            <ShoppingCart size={16} />
                                                            Add to cart
                                                        </button>
                                                        <button
                                                            onClick={() => toggleWishlist(product.product_id)}
                                                            className={`rounded-lg border px-2.5 py-2 transition ${wishlist.has(product.product_id)
                                                                ? 'border-rose-300 bg-rose-50 text-rose-600'
                                                                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                                                                }`}
                                                            aria-label="Toggle wishlist"
                                                        >
                                                            <Heart size={16} fill={wishlist.has(product.product_id) ? 'currentColor' : 'none'} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {activeTab === 'farmers' && (
                        <section>
                            {loadingFarmers ? (
                                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading farmers...</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {farmers.map((farmer) => {
                                        const initials = farmer.name
                                            .split(' ')
                                            .map((x) => x[0])
                                            .join('')
                                            .slice(0, 2)
                                            .toUpperCase();

                                        return (
                                            <button
                                                key={farmer.farmer_id}
                                                onClick={() => {
                                                    setSelectedFarmerId(farmer.farmer_id);
                                                    setActiveTab('browse');
                                                }}
                                                className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 font-black flex items-center justify-center">
                                                        {initials}
                                                    </div>
                                                    {farmer.is_certified && (
                                                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">Certified</span>
                                                    )}
                                                </div>

                                                <h3 className="mt-3 text-lg font-bold text-slate-900">{farmer.name}</h3>
                                                <p className="text-sm text-slate-600 inline-flex items-center gap-1 mt-1">
                                                    <MapPin size={13} />
                                                    {farmer.village}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-2">Land size: {farmer.area_acres} acres</p>

                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {farmer.crops.slice(0, 4).map((crop) => (
                                                        <span key={crop} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                                            {crop}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                                    <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-amber-700 font-semibold inline-flex items-center gap-1">
                                                        <Star size={12} />
                                                        {farmer.avg_rating.toFixed(1)}
                                                    </div>
                                                    <div className="rounded-lg bg-blue-50 px-2.5 py-2 text-blue-700 font-semibold inline-flex items-center gap-1">
                                                        <Package size={12} />
                                                        {farmer.total_orders_fulfilled} orders
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {activeTab === 'cart' && (
                        <section className="grid grid-cols-1 xl:grid-cols-[1fr,320px] gap-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <h2 className="text-lg font-bold text-slate-900 mb-3">My Cart</h2>
                                {loadingCart ? (
                                    <p className="text-sm text-slate-500">Loading cart...</p>
                                ) : !cart?.items?.length ? (
                                    <p className="text-sm text-slate-500">Your cart is empty.</p>
                                ) : (
                                    <div className="space-y-2.5">
                                        {cart.items.map((item) => (
                                            <div key={item.cart_item_id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{item.product?.crop_name || 'Product'}</p>
                                                    <p className="text-xs text-slate-500">{item.product?.farmer?.name || 'Farmer'} · Qty: {item.quantity} {item.product?.unit || ''}</p>
                                                    <p className="text-sm font-bold text-slate-800 mt-1">{INR.format(item.line_total)}</p>
                                                </div>
                                                <button
                                                    onClick={() => removeFromCart(item.product_id)}
                                                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 h-fit">
                                <h3 className="text-lg font-bold text-slate-900">Order Summary</h3>
                                <div className="mt-3 space-y-2 text-sm">
                                    <div className="flex items-center justify-between text-slate-600">
                                        <span>Subtotal</span>
                                        <span className="font-semibold text-slate-900">{INR.format(cart?.summary?.subtotal || 0)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-emerald-700">
                                        <span>Discount Saved</span>
                                        <span className="font-semibold">-{INR.format(cart?.summary?.total_discount || 0)}</span>
                                    </div>
                                    <div className="h-px bg-slate-200" />
                                    <div className="flex items-center justify-between text-slate-900 font-black">
                                        <span>Grand Total</span>
                                        <span>{INR.format(cart?.summary?.grand_total || 0)}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={placeOrder}
                                    disabled={placingOrder || !(cart?.items?.length)}
                                    className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    {placingOrder ? 'Placing Order...' : 'Place Order'}
                                </button>
                            </div>
                        </section>
                    )}

                    {activeTab === 'orders' && (
                        <section className="space-y-3">
                            {loadingOrders ? (
                                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading orders...</div>
                            ) : !orders.length ? (
                                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">No orders yet.</div>
                            ) : (
                                orders.map((order) => (
                                    <article key={order.order_id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-slate-500">Order ID</p>
                                                <p className="text-lg font-black text-slate-900">{order.order_id}</p>
                                                <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">
                                                    <Clock3 size={12} />
                                                    {new Date(order.ordered_at).toLocaleString()}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(order.status)}`}>
                                                    {order.status}
                                                </span>
                                                <p className="text-lg font-black text-slate-900 mt-2">{INR.format(order.total_amount)}</p>
                                            </div>
                                        </div>

                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <p className="text-xs font-semibold text-slate-500">Farmers</p>
                                                <p className="text-sm text-slate-800 mt-1">{(order.farmers || []).join(', ') || 'N/A'}</p>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <p className="text-xs font-semibold text-slate-500">Items</p>
                                                <p className="text-sm text-slate-800 mt-1">
                                                    {(order.items || [])
                                                        .map((i) => `${i.crop_name} (${i.quantity} ${i.unit})`)
                                                        .join(', ') || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </article>
                                ))
                            )}
                        </section>
                    )}
                </main>
            </div>

            {productDetailLoading && (
                <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading product detail...</div>
                </div>
            )}

            {selectedProduct && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200">
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">{selectedProduct.crop_name}</h3>
                                <p className="text-sm text-slate-600 mt-1">{selectedProduct.farmer?.name || 'Farmer'} · {selectedProduct.farmer?.village || 'Village'}</p>
                            </div>
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-sm text-slate-700">{selectedProduct.description || 'No description provided.'}</p>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">Price</p>
                                    <p className="font-bold text-slate-900">{INR.format(selectedProduct.price_per_unit)} / {selectedProduct.unit}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">Min Order</p>
                                    <p className="font-bold text-slate-900">{selectedProduct.min_order_qty} {selectedProduct.unit}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">Available</p>
                                    <p className="font-bold text-slate-900">{selectedProduct.stock_quantity} {selectedProduct.unit}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">Soil Type</p>
                                    <p className="font-bold text-slate-900">{selectedProduct.land?.soil_type || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                                <p className="text-sm font-semibold text-slate-800">Select quantity</p>
                                <div className="inline-flex items-center rounded-lg border border-slate-300 overflow-hidden">
                                    <button
                                        onClick={() =>
                                            setModalQty((q) =>
                                                Math.max((selectedProduct.min_order_qty || 1), q - (selectedProduct.min_order_qty || 1))
                                            )
                                        }
                                        className="px-3 py-2 text-slate-600 hover:bg-slate-100"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <div className="min-w-[88px] px-4 py-2 text-center text-sm font-semibold text-slate-900">
                                        {modalQty} {selectedProduct.unit}
                                    </div>
                                    <button
                                        onClick={() =>
                                            setModalQty((q) =>
                                                Math.min(
                                                    selectedProduct.stock_quantity,
                                                    q + (selectedProduct.min_order_qty || 1)
                                                )
                                            )
                                        }
                                        className="px-3 py-2 text-slate-600 hover:bg-slate-100"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>

                                <div className="text-sm space-y-1">
                                    <p className="flex justify-between text-slate-600">
                                        <span>Base total</span>
                                        <span>{INR.format(modalCalc.baseTotal)}</span>
                                    </p>
                                    <p className="flex justify-between text-emerald-700">
                                        <span>Bulk discount</span>
                                        <span>-{INR.format(modalCalc.discount)}</span>
                                    </p>
                                    <p className="flex justify-between font-bold text-slate-900">
                                        <span>Payable</span>
                                        <span>{INR.format(modalCalc.finalTotal)}</span>
                                    </p>
                                    {selectedProduct.bulk_discount_pct > 0 && (
                                        <p className="text-xs text-slate-500">
                                            Discount applies for qty {'>='} {selectedProduct.min_order_qty * selectedProduct.bulk_trigger_multiplier} {selectedProduct.unit}
                                        </p>
                                    )}
                                    {modalCalc.discountEligible && (
                                        <p className="text-xs text-emerald-700 font-semibold">Bulk discount applied</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <button
                                    onClick={() => addToCart({ seller_id: sellerId, product_id: selectedProduct.product_id, quantity: modalQty })}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600"
                                >
                                    <ShoppingCart size={16} />
                                    Add to cart
                                </button>

                                <button
                                    onClick={() =>
                                        sendPrompt(
                                            `Hi, I want details for ${selectedProduct.crop_name} from ${selectedProduct.farmer?.name || 'farmer'} in ${selectedProduct.farmer?.village || 'village'}.`
                                        )
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                    <Truck size={16} />
                                    Ask about this crop ↗
                                </button>
                            </div>

                            <div className="rounded-xl bg-slate-50 p-3 text-sm">
                                <p className="font-semibold text-slate-800">Quality Snapshot</p>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                                    <p className="inline-flex items-center gap-1"><Leaf size={12} /> Organic: {selectedProduct.is_organic ? 'Yes' : 'No'}</p>
                                    <p className="inline-flex items-center gap-1"><Clock3 size={12} /> Freshly harvested: {selectedProduct.is_freshly_harvested ? 'Yes' : 'No'}</p>
                                    <p>pH: {selectedProduct.soil_analysis?.ph_level ?? 'N/A'}</p>
                                    <p>N/P/K: {selectedProduct.soil_analysis?.nitrogen ?? 'N/A'} / {selectedProduct.soil_analysis?.phosphorus ?? 'N/A'} / {selectedProduct.soil_analysis?.potassium ?? 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SellerMarketplace;
