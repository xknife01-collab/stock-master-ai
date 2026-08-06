import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config.js';

const StickyStripBanner = ({ showAds: propShowAds }) => {
  const [showAds, setShowAds] = useState(propShowAds === true || propShowAds === 'true');

  useEffect(() => {
    if (propShowAds !== undefined && propShowAds !== null) {
      setShowAds(propShowAds === true || propShowAds === 'true');
      return;
    }
    const fetchConfig = () => {
      fetch(`${API_URL}/api/admin/config`)
        .then(res => res.json())
        .then(data => {
          if (data.config && data.config.showAds !== undefined) {
            setShowAds(data.config.showAds === true || data.config.showAds === 'true');
          }
        })
        .catch(() => {});
    };

    fetchConfig();
    const interval = setInterval(fetchConfig, 3000);
    return () => clearInterval(interval);
  }, [propShowAds]);

  useEffect(() => {
    if (showAds) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {}
    }
  }, [showAds]);

  // 🚫 어드민에서 광고 스위치가 OFF 설정되면 광고 띠 배너 영역을 100% 완전 파기(숨김)
  if (!showAds) return null;

  return (
    <div className="w-full bg-[#121722] border-t border-white/10 py-4 flex flex-col items-center justify-center my-6 rounded-2xl animate-fadeIn">
      {/* Google AdSense Responsive Strip Banner */}
      <div className="w-full max-w-4xl min-h-[60px] flex items-center justify-center overflow-hidden">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '60px' }}
          data-ad-client="ca-pub-7057055759299896"
          data-ad-slot="1234567890"
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
};

export default StickyStripBanner;
