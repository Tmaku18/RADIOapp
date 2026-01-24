'use client';

import { useState, useEffect } from 'react';
import { creditsApi, paymentsApi } from '@/lib/api';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const creditPackages = [
  { credits: 10, price: 999, label: '10 Credits', description: '$9.99' },
  { credits: 25, price: 1999, label: '25 Credits', description: '$19.99', popular: false },
  { credits: 50, price: 3499, label: '50 Credits', description: '$34.99', popular: true },
  { credits: 100, price: 5999, label: '100 Credits', description: '$59.99' },
];

interface CreditBalance {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
}

interface Transaction {
  id: string;
  amount: number;
  credits_purchased: number;
  status: string;
  created_at: string;
}

export default function CreditsPage() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [balanceRes, transactionsRes] = await Promise.all([
        creditsApi.getBalance(),
        paymentsApi.getTransactions(),
      ]);
      setBalance(balanceRes.data);
      setTransactions(transactionsRes.data || []);
    } catch (err) {
      console.error('Failed to load credits data:', err);
      setError('Failed to load credit information');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: typeof creditPackages[0]) => {
    setPurchasing(pkg.credits);
    setError(null);

    try {
      // Create checkout session
      const response = await paymentsApi.createCheckoutSession({
        amount: pkg.price,
        credits: pkg.credits,
      });

      const { url } = response.data;

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      setError('Failed to start checkout. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Balance Card */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
        <h2 className="text-lg font-medium text-purple-200 mb-2">Credit Balance</h2>
        <div className="text-5xl font-bold mb-4">{balance?.balance || 0}</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-purple-200">Total Purchased:</span>
            <span className="ml-2 font-medium">{balance?.totalPurchased || 0}</span>
          </div>
          <div>
            <span className="text-purple-200">Total Used:</span>
            <span className="ml-2 font-medium">{balance?.totalUsed || 0}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Purchase Credits */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Buy Credits</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {creditPackages.map((pkg) => (
            <div
              key={pkg.credits}
              className={`relative rounded-xl p-6 border-2 transition-all ${
                pkg.popular
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    BEST VALUE
                  </span>
                </div>
              )}
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{pkg.credits}</div>
                <div className="text-sm text-gray-500 mb-2">credits</div>
                <div className="text-xl font-semibold text-gray-900 mb-4">
                  {pkg.description}
                </div>
                <button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing !== null}
                  className={`w-full py-2 rounded-lg font-medium transition-colors ${
                    pkg.popular
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {purchasing === pkg.credits ? 'Processing...' : 'Buy'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-500 text-center mt-6">
          Credits are used to promote your tracks. 1 credit = 1 play to a real listener.
        </p>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Transaction History</h2>
        </div>
        
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No transactions yet. Purchase credits to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {tx.credits_purchased} Credits
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">
                    ${(tx.amount / 100).toFixed(2)}
                  </p>
                  <p className={`text-sm capitalize ${
                    tx.status === 'succeeded' ? 'text-green-600' :
                    tx.status === 'pending' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
