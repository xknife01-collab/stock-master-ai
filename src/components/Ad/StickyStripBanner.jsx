import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config.js';

const StickyStripBanner = () => {
  const [showAds, setShowAds] = useState(true);

  useEffect(() => {
    // 어드민 광고 마스터 설정 조회
    fetch(`${API_URL}/api/admin/config`)
      .then(res => res.json())
      .then(data => {
        if (data.config && typeof data.config.showAds === 'boolean') {
          setShowAds(data.config.showAds);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (showAds) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) { }
    }
  }, [showAds]);

  if (!showAds) return null;

  return (
    <div className="w-full bg-[#121722] border-t border-white/10 py-4 flex flex-col items-center justify-center my-6">
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
