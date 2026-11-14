import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  XCircle,
  Split,
  BellRing,
} from 'lucide-react';
import { useHospitality } from '../context/HospitalityContext';
import {
  DepartmentName,
  MenuProduct,
  Order,
  OrderChannel,
  OrderPayment,
  PaymentMethod,
} from '../types/hospitality';
import { formatMoney, formatTimeShort } from '../utils/formatters';

interface PosViewProps {
  preselectedTableId?: string;
  onClearPreselectedTable?: () => void;
}

const CATEGORIES = [
  'All Items',
  'Grill & Burgers',
  'Main Dishes',
  'Fresh Juices',
  'Soft Drinks',
  'Beer & Spirits',
  'Coffee & Bakery',
] as const;

const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'POS / Card',
  'Mobile Money',
  'Bank Transfer',
  'Credit / Deferred',
  'Bono Voucher',
];

export const PosView: React.FC<PosViewProps> = ({
  preselectedTableId,
  onClearPreselectedTable,
}) => {
  const { state, currentEmployee, createOrder, updateOrderStatus, hasPermission } =
    useHospitality();

  const [category, setCategory] = useState<string>('All Items');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<OrderChannel>('Dine-In');
  const [selectedTableId, setSelectedTableId] = useState<string>(preselectedTableId || '');
  const [customerName, setCustomerName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [cart, setCart] = useState<{ product: MenuProduct; quantity: number }[]>([]);

  // Payment State
  const [primaryMethod, setPrimaryMethod] = useState<PaymentMethod>('Cash');
  const [splitPayment, setSplitPayment] = useState(false);
  const [secondaryMethod, setSecondaryMethod] = useState<PaymentMethod>('Mobile Money');
  const [secondaryAmount, setSecondaryAmount] = useState<string>('0');
  const [paymentRef, setPaymentRef] = useState('');

  // Feedback & Receipt Modal
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const filteredProducts = useMemo(() => {
    return state.menuProducts.filter((p) => {
      const matchesCat = category === 'All Items' || p.category === category;
      const matchesSearch =
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchesDept =
        state.activeDepartment === 'All Departments' || p.department === state.activeDepartment;
      return matchesCat && matchesSearch && matchesDept;
    });
  }, [state.menuProducts, category, search, state.activeDepartment]);

  const addToCart = (product: MenuProduct) => {
    if (!product.isAvailable) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setFeedback(null);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const subtotal = cart.reduce(
    (s, l) => s + (l.product.promoPrice ?? l.product.sellingPrice) * l.quantity,
    0
  );
  const taxAmount = Number(((subtotal * state.config.taxRatePercent) / 100).toFixed(2));
  const serviceAmount = Number(((subtotal * state.config.serviceChargePercent) / 100).toFixed(2));
  const grandTotal = Number((subtotal + taxAmount + serviceAmount).toFixed(2));

  const readyOrders = state.orders.filter((o) => o.status === 'Ready');
  const myOrders = state.orders
    .filter((o) =>
      hasPermission('view_dashboard') ? true : o.cashierId === currentEmployee.id
    )
    .slice(0, 6);

  const handleCheckout = () => {
    if (cart.length === 0) {
      setFeedback({ ok: false, text: 'Select at least one product to create an order.' });
      return;
    }
    if (channel === 'Dine-In' && state.config.enableTableManagement && !selectedTableId) {
      setFeedback({ ok: false, text: 'Please select a table for Dine-In orders.' });
      return;
    }
    if (channel === 'Room Service' && !roomNumber.trim()) {
      setFeedback({ ok: false, text: 'Please enter the hotel room number.' });
      return;
    }

    const payments: OrderPayment[] = [];
    if (splitPayment) {
      const secAmt = Math.min(grandTotal, Math.max(0, Number(secondaryAmount) || 0));
      const priAmt = Number((grandTotal - secAmt).toFixed(2));
      if (priAmt > 0) payments.push({ method: primaryMethod, amount: priAmt, reference: paymentRef || undefined });
      if (secAmt > 0) payments.push({ method: secondaryMethod, amount: secAmt });
    } else {
      payments.push({ method: primaryMethod, amount: grandTotal, reference: paymentRef || undefined });
    }

    const dept: Exclude<DepartmentName, 'All Departments'> =
      state.activeDepartment === 'All Departments' ? 'Main Restaurant' : state.activeDepartment;

    const result = createOrder({
      channel,
      department: dept,
      tableId: channel === 'Dine-In' ? selectedTableId : undefined,
      customerName,
      roomNumber: channel === 'Room Service' ? roomNumber : undefined,
      items: cart,
      payments,
    });

    if (result.ok && result.order) {
      setCart([]);
      setCustomerName('');
      setRoomNumber('');
      setPaymentRef('');
      setSecondaryAmount('0');
      setSplitPayment(false);
      onClearPreselectedTable?.();
      setReceiptOrder(result.order);
      setFeedback({
        ok: true,
        text: `Order ${result.order.orderNumber} sent to Kitchen/Bar & payment recorded.`,
      });
    } else {
      setFeedback({ ok: false, text: result.error || 'Could not create order.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Ready Orders Banner */}
      {readyOrders.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-medium text-emerald-900">
            <BellRing className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>
              <strong>{readyOrders.length} Ready for Collection:</strong>{' '}
              {readyOrders
                .map((o) => `${o.orderNumber} (${o.tableLabel || o.roomNumber || o.channel})`)
                .join(' · ')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {readyOrders.slice(0, 3).map((o) => (
              <button
                key={o.id}
                onClick={() => updateOrderStatus(o.id, 'Completed')}
                className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
              >
                Deliver &amp; Close {o.orderNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Product Catalog */}
        <div className="xl:col-span-7 space-y-4">
          <div className="rounded-xl border border-[#E8ECF2] bg-white p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu items or SKU..."
                  className="w-full rounded-lg border border-[#E8ECF2] bg-[#F7F8FA] py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#FF5A1F] focus:bg-white transition-colors"
                />
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                {filteredProducts.length} items
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    category === cat
                      ? 'bg-[#181C24] text-white'
                      : 'bg-[#F7F8FA] text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {filteredProducts.map((product) => {
                const price = product.promoPrice ?? product.sellingPrice;
                return (
                  <button
                    key={product.id}
                    disabled={!product.isAvailable}
                    onClick={() => addToCart(product)}
                    className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                      product.isAvailable
                        ? 'border-[#E8ECF2] bg-white hover:border-[#FF5A1F] hover:bg-[#FFF9F6]'
                        : 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="font-mono">{product.sku}</span>
                        <span>{product.station}</span>
                      </div>
                      <div className="mt-1.5 font-display text-sm font-semibold text-slate-900 line-clamp-2">
                        {product.name}
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-[#FF5A1F] tabular-nums">
                        {formatMoney(price, state.config)}
                      </span>
                      {product.promoPrice && (
                        <span className="font-mono text-[11px] text-slate-400 line-through tabular-nums">
                          {formatMoney(product.sellingPrice, state.config)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cashier Recent Transactions */}
          <div className="rounded-xl border border-[#E8ECF2] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">
                Recent POS Orders &amp; Status
              </h3>
              <span className="text-xs text-slate-500">Operator: {currentEmployee.name}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8ECF2] text-[11px] font-semibold text-slate-500">
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 px-3">Channel / Table</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {myOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900 tabular-nums">
                        {o.orderNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {o.tableLabel ? `Table ${o.tableLabel}` : o.roomNumber || o.channel}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800">
                          {o.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums">
                        {formatTimeShort(o.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatMoney(o.totalAmount, state.config)}
                      </td>
                      <td className="py-2.5 pl-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => setReceiptOrder(o)}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Receipt
                        </button>
                        {o.status !== 'Completed' && o.status !== 'Cancelled' && (
                          <button
                            onClick={() => updateOrderStatus(o.id, 'Completed')}
                            className="text-xs font-medium text-emerald-700 hover:underline"
                          >
                            Complete
                          </button>
                        )}
                        {o.status !== 'Cancelled' &&
                          o.status !== 'Completed' &&
                          hasPermission('pos_cancel') && (
                            <button
                              onClick={() => setCancelTarget(o)}
                              className="text-xs font-medium text-red-600 hover:underline"
                            >
                              Cancel
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Active Ticket & Multi-Method Checkout */}
        <div className="xl:col-span-5">
          <div className="sticky top-20 rounded-xl border border-[#E8ECF2] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8ECF2] pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">Current Ticket</h2>
                <p className="text-xs text-slate-500">Auto-routes food to KDS &amp; drinks to Bar</p>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Order Channel Selector */}
            <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#F7F8FA] p-1">
              {(['Dine-In', 'Takeaway', 'Room Service'] as OrderChannel[]).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    channel === ch
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            {/* Table / Customer / Room Input */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {channel === 'Dine-In' && state.config.enableTableManagement && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Assign Table
                  </label>
                  <select
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    className="w-full rounded-lg border border-[#E8ECF2] bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-[#FF5A1F]"
                  >
                    <option value="">Select Table...</option>
                    {state.tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.status} · {t.area})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {channel === 'Room Service' && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Room Number
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. Room 304"
                    className="w-full rounded-lg border border-[#E8ECF2] px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#FF5A1F]"
                  />
                </div>
              )}
              <div className={channel === 'Takeaway' ? 'sm:col-span-2' : ''}>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Customer / Guest Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in or guest name"
                  className="w-full rounded-lg border border-[#E8ECF2] px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#FF5A1F]"
                />
              </div>
            </div>

            {/* Cart Items */}
            <div className="max-h-60 overflow-y-auto divide-y divide-[#F1F5F9] border-y border-[#E8ECF2] py-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Tap items on the left to build an order.
                </div>
              ) : (
                cart.map(({ product, quantity }) => {
                  const unitPrice = product.promoPrice ?? product.sellingPrice;
                  return (
                    <div key={product.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {product.name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {formatMoney(unitPrice, state.config)} · {product.station}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center rounded-lg border border-[#E8ECF2] bg-[#F7F8FA]">
                          <button
                            onClick={() => updateCartQty(product.id, -1)}
                            className="p-1.5 text-slate-600 hover:text-slate-900"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateCartQty(product.id, 1)}
                            className="p-1.5 text-slate-600 hover:text-slate-900"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="w-20 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {formatMoney(unitPrice * quantity, state.config)}
                        </span>
                        <button
                          onClick={() => updateCartQty(product.id, -quantity)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Totals Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatMoney(subtotal, state.config)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax ({state.config.taxRatePercent}%)</span>
                <span className="font-mono tabular-nums">{formatMoney(taxAmount, state.config)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Service Charge ({state.config.serviceChargePercent}%)</span>
                <span className="font-mono tabular-nums">{formatMoney(serviceAmount, state.config)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E8ECF2] pt-2 text-sm font-bold text-slate-900">
                <span>Total Payable</span>
                <span className="font-mono text-base text-[#FF5A1F] tabular-nums">
                  {formatMoney(grandTotal, state.config)}
                </span>
              </div>
            </div>

            {/* Payment Method & Split Payment */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700">Payment Method</label>
                <button
                  type="button"
                  onClick={() => setSplitPayment((v) => !v)}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#FF5A1F] hover:underline"
                >
                  <Split className="h-3 w-3" />
                  {splitPayment ? 'Single Payment' : 'Split Payment'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setPrimaryMethod(pm)}
                    className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors text-left truncate ${
                      primaryMethod === pm
                        ? 'border-[#181C24] bg-[#181C24] text-white'
                        : 'border-[#E8ECF2] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>

              {splitPayment && (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#E8ECF2] bg-[#F7F8FA] p-2.5">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-slate-600">
                      Second Method
                    </label>
                    <select
                      value={secondaryMethod}
                      onChange={(e) => setSecondaryMethod(e.target.value as PaymentMethod)}
                      className="w-full rounded border border-[#E8ECF2] bg-white px-2 py-1.5 text-xs"
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm} value={pm}>
                          {pm}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-slate-600">
                      Second Amount
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={grandTotal}
                      value={secondaryAmount}
                      onChange={(e) => setSecondaryAmount(e.target.value)}
                      className="w-full rounded border border-[#E8ECF2] bg-white px-2 py-1.5 font-mono text-xs tabular-nums"
                    />
                  </div>
                </div>
              )}

              {(primaryMethod === 'Bank Transfer' ||
                primaryMethod === 'Mobile Money' ||
                primaryMethod === 'Credit / Deferred') && (
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Transaction / Folio Reference (optional)"
                  className="w-full rounded-lg border border-[#E8ECF2] px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-[#FF5A1F]"
                />
              )}
            </div>

            {feedback && (
              <div
                className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                  feedback.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {feedback.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <button
              onClick={handleCheckout}
              className="w-full rounded-lg bg-[#FF5A1F] py-3 text-sm font-semibold text-white hover:bg-[#E64A12] transition-colors"
            >
              Submit Order &amp; Process Payment
            </button>
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="font-display text-base font-bold text-slate-900">
                {state.config.hotelName}
              </div>
              <div className="text-xs text-slate-500">{state.config.address}</div>
              <div className="text-xs text-slate-500 font-mono">{state.config.phone}</div>
            </div>

            <div className="text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Order:</span>
                <span className="font-bold">{receiptOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{receiptOrder.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Target:</span>
                <span>{receiptOrder.tableLabel ? `Table ${receiptOrder.tableLabel}` : receiptOrder.roomNumber || receiptOrder.channel}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span>{formatTimeShort(receiptOrder.createdAt)}</span>
              </div>
            </div>

            <div className="border-y border-dashed border-slate-300 py-2.5 space-y-1.5 text-xs">
              {receiptOrder.items.map((it) => (
                <div key={it.id} className="flex justify-between gap-2">
                  <span>
                    {it.quantity}x {it.productName}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(it.unitPrice * it.quantity, state.config)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatMoney(receiptOrder.subtotal, state.config)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax + Service</span>
                <span>
                  {formatMoney(
                    receiptOrder.taxAmount + receiptOrder.serviceChargeAmount,
                    state.config
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                <span>TOTAL</span>
                <span>{formatMoney(receiptOrder.totalAmount, state.config)}</span>
              </div>
              <div className="pt-1 text-[11px] text-slate-500">
                Paid: {receiptOrder.payments.map((p) => `${p.method} (${formatMoney(p.amount, state.config)})`).join(', ')}
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-500 pt-1">
              {state.config.receiptFooter}
            </p>

            <div className="no-print flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#181C24] py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Receipt
              </button>
              <button
                onClick={() => setReceiptOrder(null)}
                className="flex-1 rounded-lg border border-[#E8ECF2] py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Reason Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              Cancel Order {cancelTarget.orderNumber}
            </h3>
            <p className="text-xs text-slate-600">
              Per audit policy, every order cancellation requires a recorded reason.{' '}
              {cancelTarget.prepStartedAt
                ? 'Preparation already started — cancellation will be flagged for manager waste review.'
                : 'Preparation has not started — reserved inventory will be reversed automatically.'}
            </p>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter cancellation reason (e.g., Guest changed mind)"
              className="w-full rounded-lg border border-[#E8ECF2] px-3 py-2 text-sm outline-none focus:border-[#FF5A1F]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason('');
                }}
                className="rounded-lg border border-[#E8ECF2] px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Keep Order
              </button>
              <button
                onClick={() => {
                  updateOrderStatus(cancelTarget.id, 'Cancelled', cancelReason || 'Customer requested');
                  setCancelTarget(null);
                  setCancelReason('');
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
