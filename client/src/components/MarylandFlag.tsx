export const MarylandFlag = ({ className = "h-8 w-8" }: { className?: string }) => (
  <svg 
    viewBox="0 0 600 400" 
    className={className}
    aria-label="Maryland State Flag"
  >
    <rect width="600" height="400" fill="#231F20"/>
    <rect x="0" y="0" width="300" height="200" fill="#FFB81C"/>
    <rect x="300" y="0" width="300" height="200" fill="#231F20"/>
    <rect x="0" y="200" width="300" height="200" fill="#231F20"/>
    <rect x="300" y="200" width="300" height="200" fill="#FFB81C"/>
    <path d="M0,0 L60,40 L0,80 Z" fill="#C5203A"/>
    <path d="M60,0 L120,40 L60,80 Z" fill="#C5203A"/>
    <path d="M120,0 L180,40 L120,80 Z" fill="#C5203A"/>
    <path d="M180,0 L240,40 L180,80 Z" fill="#C5203A"/>
    <path d="M240,0 L300,40 L240,80 Z" fill="#C5203A"/>
  </svg>
);

export const MarylandLogo = ({ className = "h-10 w-10" }: { className?: string }) => (
  <svg
    viewBox="0 0 100 100"
    className={className}
    aria-label="Maryland Logo"
  >
    <rect width="100" height="100" fill="#0D4F8B"/>
    <circle cx="50" cy="50" r="35" fill="none" stroke="#FFB81C" strokeWidth="4"/>
    <text x="50" y="60" fontFamily="Montserrat" fontSize="40" fontWeight="bold" fill="#FFB81C" textAnchor="middle">MD</text>
  </svg>
);
