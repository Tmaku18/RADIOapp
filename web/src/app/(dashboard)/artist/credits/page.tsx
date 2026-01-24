'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { creditsApi, paymentsApi } from '@/lib/api';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const creditPackages = [
  { credits: 100, price: 999, label: '100 Credits', description: '$9.99', minutes: '~8 min' },
  { credits: 300, price: 1999, label: '300 Credits', description: '$19.99', minutes: '~25 min' },
  { credits: 600, price: 3499, label: '600 Credits', description: '$34.99', minutes: '~50 min', popular: true },
  { credits: 1200, price: 5999, label: '1200 Credits', description: '$59.99', minutes: '~100 min' },
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
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-purple-200 mb-2">Credit Bank</h2>
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
          <Link
            href="/artist/songs"
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>Allocate to Songs</span>
            <span>→</span>
          </Link>
        </div>
      </div>
      
      {/* How It Works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3">How Credits Work</h3>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li><strong>Buy credits</strong> below to add them to your Credit Bank</li>
          <li><strong>Allocate credits</strong> to specific songs via the "My Songs" page</li>
          <li><strong>Songs with credits</strong> get priority in the radio rotation</li>
          <li><strong>1 credit = 5 seconds</strong> of airtime (a 3-min song costs ~36 credits per play)</li>
        </ol>
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
                <div className="text-sm text-gray-500 mb-1">credits</div>
                <div className="text-xs text-purple-600 font-medium mb-2">{pkg.minutes} airtime</div>
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
          Credits go to your Credit Bank. Allocate them to songs via "My Songs" to get radio airtime.
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
