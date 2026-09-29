import React from 'react';

export default function DashboardSkeleton() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      color: '#111827',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      paddingBottom: '80px',
      overflowX: 'hidden'
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-pulse {
          background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 37%, #e5e7eb 63%);
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
          border-radius: 8px;
        }
      `}</style>

      {/* Top Bar Skeleton */}
      <header style={{
        height: '60px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton-pulse" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
          <div className="skeleton-pulse" style={{ width: '120px', height: '20px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton-pulse" style={{ width: '160px', height: '28px', borderRadius: '999px' }} />
          <div className="skeleton-pulse" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
        </div>
      </header>

      {/* Toolbar Skeleton */}
      <div style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #f3f4f6'
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="skeleton-pulse" style={{ width: '180px', height: '36px', borderRadius: '10px' }} />
          <div className="skeleton-pulse" style={{ width: '110px', height: '36px', borderRadius: '10px' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="skeleton-pulse" style={{ width: '120px', height: '36px', borderRadius: '10px' }} />
          <div className="skeleton-pulse" style={{ width: '130px', height: '36px', borderRadius: '10px' }} />
        </div>
      </div>

      {/* Main Content Area */}
      <main style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* Stat Cards Skeleton Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '28px'
        }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{
              backgroundColor: '#ffffff',
              padding: '20px',
              borderRadius: '14px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div className="skeleton-pulse" style={{ width: '80px', height: '14px', marginBottom: '14px' }} />
              <div className="skeleton-pulse" style={{ width: '130px', height: '28px', marginBottom: '10px' }} />
              <div className="skeleton-pulse" style={{ width: '100px', height: '12px' }} />
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          {/* Table Header Row Skeleton */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '60px 110px 140px 100px 100px 110px 110px 120px 100px 1fr',
            padding: '16px 20px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            gap: '12px',
            alignItems: 'center'
          }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(h => (
              <div key={h} className="skeleton-pulse" style={{ height: '14px', width: '80%' }} />
            ))}
          </div>

          {/* Table Body Row Skeletons */}
          {[1, 2, 3, 4, 5, 6, 7].map(r => (
            <div key={r} style={{
              display: 'grid',
              gridTemplateColumns: '60px 110px 140px 100px 100px 110px 110px 120px 100px 1fr',
              padding: '18px 20px',
              borderBottom: '1px solid #f3f4f6',
              gap: '12px',
              alignItems: 'center'
            }}>
              <div className="skeleton-pulse" style={{ height: '16px', width: '50%' }} />
              <div className="skeleton-pulse" style={{ height: '16px', width: '85%' }} />
              <div className="skeleton-pulse" style={{ height: '18px', width: '75%', borderRadius: '6px' }} />
              <div className="skeleton-pulse" style={{ height: '16px', width: '70%' }} />
              <div className="skeleton-pulse" style={{ height: '22px', width: '65%', borderRadius: '999px' }} />
              <div className="skeleton-pulse" style={{ height: '16px', width: '80%' }} />
              <div className="skeleton-pulse" style={{ height: '16px', width: '80%' }} />
              <div className="skeleton-pulse" style={{ height: '16px', width: '70%' }} />
              <div className="skeleton-pulse" style={{ height: '20px', width: '60%', borderRadius: '6px' }} />
              <div className="skeleton-pulse" style={{ height: '16px', width: '90%' }} />
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
