import { useTheme } from '../contexts/ThemeContext';

export default function GovFooter({ className = 'mt-12' }: { className?: string }) {
  const { language } = useTheme();
  const isHi = language === 'hi';

  return (
    <footer className={`relative z-20 w-full bg-[#eef4f9] text-slate-700 text-xs border-t border-slate-300 border-b border-slate-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img src="/incois-logo.svg" alt="INCOIS Seal" className="w-8 h-8 object-contain" />
              <span className="font-bold text-[#005088] text-sm">INCOIS &bull; MoES</span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              {isHi
                ? 'भारतीय राष्ट्रीय महासागर सूचना सेवा केंद्र (आईएनसीओआईएस), पृथ्वी विज्ञान मंत्रालय, भारत सरकार।'
                : 'Indian National Centre for Ocean Information Services (INCOIS), Ministry of Earth Sciences, Government of India.'}
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              Smart India Hackathon (SIH) 2026 &bull; Problem Statement 66
            </p>
          </div>

          <div>
            <h5 className="font-bold text-[#005088] text-xs uppercase tracking-wider mb-3 pb-1 border-b border-slate-300">
              {isHi ? 'महासागरीय सेवाएं' : 'Ocean Services'}
            </h5>
            <ul className="space-y-1.5 text-slate-600">
              <li><span>{isHi ? 'परिचालन डैशबोर्ड' : 'Ocean Telemetry Dashboard'}</span></li>
              <li><span>{isHi ? '3D आयामी क्यूब' : '3D Volumetric Cube'}</span></li>
              <li><span>{isHi ? 'चक्रवात ऊष्मा ईंधन व कोल्ड वेक' : 'Cyclone Fuel & Cold Wake'}</span></li>
              <li><span>{isHi ? '7-दिवसीय पूर्वानुमान' : '7-Day Subsurface Forecast'}</span></li>
              <li><span>{isHi ? 'आर्गो फ्लोट सत्यापन' : 'ARGO Float Validation'}</span></li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-[#005088] text-xs uppercase tracking-wider mb-3 pb-1 border-b border-slate-300">
              {isHi ? 'सरकारी पोर्टल व लिंक' : 'Government Portals'}
            </h5>
            <ul className="space-y-1.5 text-slate-600">
              <li><span>Ministry of Earth Sciences (MoES)</span></li>
              <li><span>INCOIS Portal</span></li>
              <li><span>India Meteorological Department (IMD)</span></li>
              <li><span>NDMA Portal (ndma.gov.in)</span></li>
              <li><span>Digital India</span></li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-[#005088] text-xs uppercase tracking-wider mb-3 pb-1 border-b border-slate-300">
              {isHi ? 'वेबसाइट नीतियां' : 'Website Policies'}
            </h5>
            <ul className="space-y-1.5 text-slate-600">
              <li><span>{isHi ? 'कॉपीराइट नीति' : 'Copyright Policy'}</span></li>
              <li><span>{isHi ? 'गोपनीयता नीति' : 'Privacy Policy'}</span></li>
              <li><span>{isHi ? 'उपयोग की शर्तें' : 'Terms of Use'}</span></li>
              <li><span>{isHi ? 'अभिगम्यता वक्तव्य' : 'Accessibility Statement'}</span></li>
              <li><span>{isHi ? 'हाइपरलिंकिंग नीति' : 'Hyperlinking Policy'}</span></li>
            </ul>
          </div>

        </div>

        <div className="pt-6 border-t border-slate-300 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            &copy; 2026 National Ocean Information Portal. Designed &amp; Maintained for Smart India Hackathon.
          </div>
          <div className="flex items-center gap-4">
            <span>Last Updated: 16-Sep-2026</span>
            <span>&bull;</span>
            <span>Security Audited: NIC / STQC</span>
            <span>&bull;</span>
            <span>Visitors: 2,481,902</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
