import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing - RadioApp',
  description: 'Simple, transparent pricing for artists. Listeners always free.',
};

export const revalidate = 3600;

const creditPackages = [
  {
    credits: 10,
    price: 9.99,
    popular: false,
    description: 'Perfect for testing the waters',
  },
  {
    credits: 25,
    price: 19.99,
    popular: false,
    description: 'Great for single releases',
  },
  {
    credits: 50,
    price: 34.99,
    popular: true,
    description: 'Best value for regular promotion',
  },
  {
    credits: 100,
    price: 59.99,
    popular: false,
    description: 'For serious campaigns',
  },
];

export default function PricingPage() {
  return (
    <div className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600">
            Listening is always free. Artists pay only for promotion.
          </p>
        </div>

        {/* Listener Section */}
        <div className="mb-20">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-4">For Listeners</h2>
            <div className="text-5xl font-bold mb-2">Free</div>
            <p className="text-purple-200 mb-6">Forever. No ads. No limits.</p>
            <ul className="text-left max-w-md mx-auto space-y-3 mb-8">
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                Unlimited streaming
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                Like and save tracks
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                Follow artists
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                Web and mobile access
              </li>
            </ul>
            <Link
              href="/signup?role=listener"
              className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors inline-block"
            >
              Start Listening
            </Link>
          </div>
        </div>

        {/* Artist Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            For Artists - Play Credits
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Credits are used to promote your tracks in our radio rotation. 
            One credit = one play to a real listener. No bots, no fake streams.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {creditPackages.map((pkg) => (
              <div
                key={pkg.credits}
                className={`relative rounded-2xl p-6 ${
                  pkg.popular
                    ? 'bg-purple-600 text-white ring-4 ring-purple-600 ring-offset-2'
                    : 'bg-white border border-gray-200'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <div className="text-center">
                  <div className={`text-4xl font-bold mb-1 ${pkg.popular ? 'text-white' : 'text-gray-900'}`}>
                    {pkg.credits}
                  </div>
                  <div className={`text-sm mb-4 ${pkg.popular ? 'text-purple-200' : 'text-gray-500'}`}>
                    credits
                  </div>
                  <div className={`text-3xl font-bold mb-2 ${pkg.popular ? 'text-white' : 'text-gray-900'}`}>
                    ${pkg.price}
                  </div>
                  <div className={`text-sm mb-6 ${pkg.popular ? 'text-purple-200' : 'text-gray-500'}`}>
                    ${(pkg.price / pkg.credits).toFixed(2)} per credit
                  </div>
                  <p className={`text-sm mb-6 ${pkg.popular ? 'text-purple-100' : 'text-gray-600'}`}>
                    {pkg.description}
                  </p>
                  <Link
                    href="/signup?role=artist"
                    className={`block w-full py-2 rounded-lg font-semibold transition-colors ${
                      pkg.popular
                        ? 'bg-white text-purple-600 hover:bg-purple-50'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Link */}
        <div className="text-center mt-16">
          <p className="text-gray-600">
            Have questions?{' '}
            <Link href="/faq" className="text-purple-600 hover:text-purple-700 font-medium">
              Check our FAQ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
