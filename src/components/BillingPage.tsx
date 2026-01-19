import React, { useState } from 'react';
import { 
  ArrowLeft, 
  CreditCard, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  Receipt, 
  Shield, 
  Clock,
  Star,
  Zap,
  Crown,
  Gift,
  RefreshCw,
  X,
  Check,
  Info
} from 'lucide-react';

interface BillingPageProps {
  onNavigateBack: () => void;
}

interface Subscription {
  id: string;
  programName: string;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  startDate: string;
  endDate: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'one-time' | 'yearly';
  nextBilling?: string;
  autoRenew: boolean;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  description: string;
  downloadUrl: string;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

const BillingPage = ({ onNavigateBack }: BillingPageProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payment-methods'>('overview');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Mock data - in real app this would come from API
  const subscription: Subscription = {
    id: 'sub_123456',
    programName: 'IMPROVE YOUR SQUAT',
    status: 'active',
    startDate: '2024-01-15',
    endDate: '2024-04-15',
    price: 99,
    currency: 'TND',
    billingCycle: 'one-time',
    autoRenew: false
  };

  const invoices: Invoice[] = [
    {
      id: 'inv_001',
      date: '2024-01-15',
      amount: 99,
      currency: 'TND',
      status: 'paid',
      description: 'IMPROVE YOUR SQUAT - 12 Week Program',
      downloadUrl: '#'
    },
    {
      id: 'inv_002',
      date: '2023-12-15',
      amount: 59,
      currency: 'TND',
      status: 'paid',
      description: 'Mobility Mastery Guide',
      downloadUrl: '#'
    }
  ];

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'pm_001',
      type: 'card',
      last4: '4242',
      brand: 'Visa',
      expiryMonth: 12,
      expiryYear: 2026,
      isDefault: true
    }
  ];

  const availablePrograms = [
    {
      name: 'POWERLIFTING - COMPETITION PREP',
      price: 129,
      currency: 'TND',
      duration: '6 weeks',
      features: ['Competition simulation', 'Attempt selection strategy', 'Mental preparation'],
      popular: false
    },
    {
      name: 'ELITE 1-ON-1 COACHING',
      price: 297,
      currency: 'TND',
      duration: 'Monthly',
      features: ['Weekly video analysis', 'Custom programming', 'Direct WhatsApp support'],
      popular: true
    },
    {
      name: 'OLYMPIC WEIGHTLIFTING MASTERY',
      price: 119,
      currency: 'TND',
      duration: '8 weeks',
      features: ['Technical development', 'Daily mobility routines', 'Strength protocols'],
      popular: false
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'expired': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      case 'trial': return 'text-blue-600 bg-blue-100';
      case 'paid': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'paid':
        return <CheckCircle className="w-4 h-4" />;
      case 'expired':
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const CancelModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-xl font-bold text-gray-900">Cancel Subscription</h3>
          <button 
            onClick={() => setShowCancelModal(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800 mb-1">Are you sure?</h4>
                  <p className="text-sm text-red-700">
                    Cancelling will end your access to the program materials and coaching support. 
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-gray-600 text-sm">
              Your access will continue until {new Date(subscription.endDate).toLocaleDateString()}, 
              but you won't be charged again.
            </p>
          </div>
        </div>
        
        <div className="px-6 pb-6">
          <div className="flex space-x-3">
            <button 
              onClick={() => setShowCancelModal(false)}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Keep Subscription
            </button>
            <button className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Cancel Subscription
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const UpgradeModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-2xl font-bold text-gray-900">Upgrade Your Training</h3>
          <button 
            onClick={() => setShowUpgradeModal(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availablePrograms.map((program, index) => (
              <div key={index} className={`relative border-2 rounded-2xl p-6 ${program.popular ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}>
                {program.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-red-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-2">{program.name}</h4>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {program.price} {program.currency}
                  </div>
                  <div className="text-sm text-gray-600">{program.duration}</div>
                </div>
                
                <div className="space-y-3 mb-6">
                  {program.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
                
                <button className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                  program.popular 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'border border-gray-300 text-gray-700 hover:border-red-600 hover:text-red-600'
                }`}>
                  Select Program
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button 
                onClick={onNavigateBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <img 
                  src="/Blue White Yellow Modern Creative Sports Fest Promotion Instagram Post (Instagram Post (45)).png" 
                  alt="Elyes Lift Academy Logo"
                  className="w-16 h-16 object-contain"
                />
                <h1 className="text-xl font-semibold text-gray-900">Billing & Subscription</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'overview' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'invoices' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveTab('payment-methods')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'payment-methods' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Payment Methods
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Current Subscription */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Current Subscription</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${getStatusColor(subscription.status)}`}>
                  {getStatusIcon(subscription.status)}
                  <span className="ml-1 capitalize">{subscription.status}</span>
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Program</div>
                  <div className="font-semibold text-gray-900">{subscription.programName}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Price</div>
                  <div className="font-semibold text-gray-900">{subscription.price} {subscription.currency}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Start Date</div>
                  <div className="font-semibold text-gray-900">{new Date(subscription.startDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">End Date</div>
                  <div className="font-semibold text-gray-900">{new Date(subscription.endDate).toLocaleDateString()}</div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => setShowUpgradeModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade Program
                  </button>
                  <button className="border border-gray-300 text-gray-700 hover:border-red-600 hover:text-red-600 px-4 py-2 rounded-lg font-medium transition-colors flex items-center">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Renew Program
                  </button>
                  <button 
                    onClick={() => setShowCancelModal(true)}
                    className="border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Receipt className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{invoices.length}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Total Invoices</h3>
                <p className="text-sm text-gray-600">All-time billing history</p>
              </div>
              
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {Math.ceil((new Date(subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Days Remaining</h3>
                <p className="text-sm text-gray-600">Until program expires</p>
              </div>
              
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Star className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-2xl font-bold text-gray-900">
                    {invoices.reduce((sum, inv) => sum + inv.amount, 0)} {subscription.currency}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Total Spent</h3>
                <p className="text-sm text-gray-600">Lifetime investment</p>
              </div>
            </div>
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <div className="bg-white rounded-2xl shadow-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Billing History</h2>
              <p className="text-gray-600 mt-1">Download and manage your invoices</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">#{invoice.id}</div>
                          <div className="text-sm text-gray-500">{invoice.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.amount} {invoice.currency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center w-fit ${getStatusColor(invoice.status)}`}>
                          {getStatusIcon(invoice.status)}
                          <span className="ml-1 capitalize">{invoice.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button className="text-red-600 hover:text-red-700 font-medium flex items-center">
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Methods Tab */}
        {activeTab === 'payment-methods' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Payment Methods</h2>
                <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  Add Payment Method
                </button>
              </div>
              
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <CreditCard className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {method.brand} ending in {method.last4}
                        </div>
                        <div className="text-sm text-gray-500">
                          Expires {method.expiryMonth}/{method.expiryYear}
                        </div>
                        {method.isDefault && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                            <Shield className="w-3 h-3 mr-1" />
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!method.isDefault && (
                        <button className="text-red-600 hover:text-red-700 text-sm font-medium">
                          Set as Default
                        </button>
                      )}
                      <button className="text-gray-600 hover:text-gray-700 text-sm font-medium">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-800 mb-1">Secure Payments</h3>
                  <p className="text-sm text-blue-700">
                    All payment information is encrypted and securely processed. We never store your full card details.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCancelModal && <CancelModal />}
      {showUpgradeModal && <UpgradeModal />}
    </div>
  );
};

export default BillingPage;
