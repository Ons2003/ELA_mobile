import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader, Database, Wifi, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface HealthStatus {
  connection: 'checking' | 'connected' | 'failed';
  auth: 'checking' | 'working' | 'failed';
  database: 'checking' | 'working' | 'failed';
  tables: 'checking' | 'working' | 'failed';
  error?: string;
}

const DatabaseHealthCheck = () => {
  const [status, setStatus] = useState<HealthStatus>({
    connection: 'checking',
    auth: 'checking',
    database: 'checking',
    tables: 'checking'
  });

  useEffect(() => {
    checkDatabaseHealth();
  }, []);

  const checkDatabaseHealth = async () => {
    try {
      // Test 1: Basic connection
      setStatus(prev => ({ ...prev, connection: 'checking' }));
      
      // Test 2: Auth service
      setStatus(prev => ({ ...prev, connection: 'connected', auth: 'checking' }));
      const { data: session } = await supabase.auth.getSession();
      setStatus(prev => ({ ...prev, auth: 'working' }));

      // Test 3: Database query
      setStatus(prev => ({ ...prev, database: 'checking' }));
      const { data: testQuery, error: dbError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (dbError) {
        throw new Error(`Database query failed: ${dbError.message}`);
      }
      
      setStatus(prev => ({ ...prev, database: 'working' }));

      // Test 4: Check if required tables exist
      setStatus(prev => ({ ...prev, tables: 'checking' }));
      const { data: programs, error: programsError } = await supabase
        .from('programs')
        .select('id')
        .limit(1);

      if (programsError) {
        throw new Error(`Tables check failed: ${programsError.message}`);
      }

      setStatus(prev => ({ ...prev, tables: 'working' }));

    } catch (error: any) {
      console.error('Database health check failed:', error);
      setStatus(prev => ({
        ...prev,
        connection: prev.connection === 'checking' ? 'failed' : prev.connection,
        auth: prev.auth === 'checking' ? 'failed' : prev.auth,
        database: prev.database === 'checking' ? 'failed' : prev.database,
        tables: prev.tables === 'checking' ? 'failed' : prev.tables,
        error: error.message
      }));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'checking':
        return <Loader className="w-5 h-5 animate-spin text-blue-500" />;
      case 'connected':
      case 'working':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'checking':
        return 'Checking...';
      case 'connected':
      case 'working':
        return 'Working';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checking':
        return 'text-blue-600';
      case 'connected':
      case 'working':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const allWorking = status.connection === 'connected' && 
                   status.auth === 'working' && 
                   status.database === 'working' && 
                   status.tables === 'working';

  const anyFailed = status.connection === 'failed' || 
                   status.auth === 'failed' || 
                   status.database === 'failed' || 
                   status.tables === 'failed';

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 flex items-center">
          <Database className="w-6 h-6 mr-2" />
          Database Health Check
        </h3>
        <button 
          onClick={checkDatabaseHealth}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          Recheck
        </button>
      </div>

      {/* Overall Status */}
      <div className={`p-4 rounded-lg mb-6 ${
        allWorking ? 'bg-green-50 border border-green-200' :
        anyFailed ? 'bg-red-50 border border-red-200' :
        'bg-blue-50 border border-blue-200'
      }`}>
        <div className="flex items-center">
          {allWorking ? (
            <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
          ) : anyFailed ? (
            <XCircle className="w-6 h-6 text-red-600 mr-3" />
          ) : (
            <Loader className="w-6 h-6 text-blue-600 mr-3 animate-spin" />
          )}
          <div>
            <h4 className={`font-semibold ${
              allWorking ? 'text-green-800' :
              anyFailed ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {allWorking ? 'Database Fully Functional' :
               anyFailed ? 'Database Issues Detected' :
               'Checking Database Status...'}
            </h4>
            <p className={`text-sm ${
              allWorking ? 'text-green-700' :
              anyFailed ? 'text-red-700' :
              'text-blue-700'
            }`}>
              {allWorking ? 'All systems operational' :
               anyFailed ? 'Some services are experiencing issues' :
               'Running diagnostics...'}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Wifi className="w-5 h-5 text-gray-600 mr-3" />
            <span className="font-medium text-gray-900">Supabase Connection</span>
          </div>
          <div className="flex items-center">
            {getStatusIcon(status.connection)}
            <span className={`ml-2 font-medium ${getStatusColor(status.connection)}`}>
              {getStatusText(status.connection)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-gray-600 mr-3" />
            <span className="font-medium text-gray-900">Authentication Service</span>
          </div>
          <div className="flex items-center">
            {getStatusIcon(status.auth)}
            <span className={`ml-2 font-medium ${getStatusColor(status.auth)}`}>
              {getStatusText(status.auth)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Database className="w-5 h-5 text-gray-600 mr-3" />
            <span className="font-medium text-gray-900">Database Queries</span>
          </div>
          <div className="flex items-center">
            {getStatusIcon(status.database)}
            <span className={`ml-2 font-medium ${getStatusColor(status.database)}`}>
              {getStatusText(status.database)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-gray-600 mr-3" />
            <span className="font-medium text-gray-900">Required Tables</span>
          </div>
          <div className="flex items-center">
            {getStatusIcon(status.tables)}
            <span className={`ml-2 font-medium ${getStatusColor(status.tables)}`}>
              {getStatusText(status.tables)}
            </span>
          </div>
        </div>
      </div>

      {/* Error Details */}
      {status.error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-semibold text-red-800 mb-2">Error Details:</h4>
          <p className="text-sm text-red-700 font-mono">{status.error}</p>
        </div>
      )}

      {/* Connection Info */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-2">Connection Info:</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Project URL:</strong> {import.meta.env.VITE_SUPABASE_URL || 'Not configured'}</p>
          <p><strong>Environment:</strong> {import.meta.env.MODE}</p>
          <p><strong>Last Check:</strong> {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
};

export default DatabaseHealthCheck;